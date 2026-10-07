import assert from 'node:assert/strict'
import {test} from 'node:test'
import express from 'express'
import type {SupabaseClient} from '@supabase/supabase-js'
import {createWalletRouter,authorizeWalletRpc,type WalletOptions} from '../src/routes/wallet'
import {generateWalletPass,loadWalletConfig,validateWalletConfig,type WalletConfig,type WalletTicket} from '../src/wallet/pass'
import {mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const id='81000000-0000-4000-8000-000000000001'
const ticket:WalletTicket={registration_id:id,event_id:'82000000-0000-4000-8000-000000000001',title:'Synthetic event',event_date:'2026-12-01T18:00:00Z',location:'Test venue',ticket_name:'General',token:'a'.repeat(64)}
const config={} as WalletConfig
async function request(body:unknown={registrationId:id},token:string|null='valid',options:WalletOptions={},method='POST'){
 let signs=0
 const client={auth:{getUser:async(t:string)=>({data:{user:t==='valid'?{id:'verified-user'}:null},error:null})}} as unknown as SupabaseClient
 const app=express();app.use(express.json());app.use('/wallet',createWalletRouter(client,{config:()=>config,authorize:async()=>ticket,sign:()=>{signs++;return Buffer.from('synthetic route bytes')},...options}));const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
 try{const response=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/wallet/${method==='GET'?'status':'pass'}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.text(),signs,headers:response.headers}}
 finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}
}
test('Wallet status and downloads require verified session',async()=>{assert.equal((await request(undefined,null)).status,401);assert.equal((await request(undefined,'expired',{},'GET')).status,401)})
test('unconfigured signing reports unavailable and503 without ticket access',async()=>{let calls=0;const options={config:()=>null,authorize:async()=>{calls++;return ticket}};assert.deepEqual(JSON.parse((await request(undefined,'valid',options,'GET')).body),{available:false});assert.equal((await request(undefined,'valid',options)).status,503);assert.equal(calls,0);assert.equal(loadWalletConfig({}),null)})
test('caller cannot supply barcode, identity, payload, path or TTL',async()=>{for(const key of ['token','userId','payload','path','expiresIn']){const result=await request({registrationId:id,[key]:'forged'});assert.equal(result.status,400);assert.equal(result.signs,0)}})
test('denied current owner/member entitlement never reaches signer',async()=>{const result=await request(undefined,'valid',{authorize:async(token,registrationId)=>{assert.equal(token,'valid');assert.equal(registrationId,id);return null}});assert.equal(result.status,403);assert.equal(result.signs,0)})
test('malformed database identity or barcode fails closed',async()=>{for(const change of [{registration_id:'other'},{token:id},{event_date:'invalid'},{title:'x'.repeat(201)}]){const result=await request(undefined,'valid',{authorize:async()=>({...ticket,...change})});assert.equal(result.status,503);assert.equal(result.signs,0)}})
test('download fixed MIME filename and private noncacheable response',async()=>{const result=await request();assert.equal(result.status,200);assert.match(result.headers.get('content-type')!,/^application\/vnd.apple.pkpass/);assert.equal(result.headers.get('content-disposition'),'attachment; filename="ticket.pkpass"');assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('referrer-policy'),'no-referrer');assert.doesNotMatch(result.headers.get('ratelimit-policy')||'',/pk=|verified-user/)})
test('signing/authorization failures reveal no credentials',async()=>{for(const options of [{authorize:async()=>{throw Error('secret-certificate')}},{sign:()=>{throw Error('secret-key')}}]){const result=await request(undefined,'valid',options);assert.equal(result.status,503);assert.doesNotMatch(result.body,/secret/)}})
test('ticket RPC carries verified caller JWT, not service identity',async()=>{
 const previousUrl=process.env.SUPABASE_URL,previousKey=process.env.SUPABASE_SERVICE_KEY
 const app=express();app.use(express.json());app.post('/rest/v1/rpc/get_my_ticket',(req,res)=>{assert.equal(req.headers.authorization,'Bearer caller-jwt');assert.equal(req.headers.apikey,'synthetic-api-key');assert.deepEqual(req.body,{p_registration_id:id});res.json(ticket)})
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
 try{process.env.SUPABASE_URL=`http://127.0.0.1:${(server.address() as {port:number}).port}`;process.env.SUPABASE_SERVICE_KEY='synthetic-api-key';assert.deepEqual(await authorizeWalletRpc('caller-jwt',id),ticket)}finally{if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_KEY;else process.env.SUPABASE_SERVICE_KEY=previousKey;await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
test('real ZIP manifest and detached PKCS7 verify; synthetic cert never passes Apple trust validation',()=>{
 // Ephemeral local test data only, never Apple credentials or a device-valid pass.
 const dir=mkdtempSync(join(tmpdir(),'thabaat-wallet-format-test-'))
 const openssl=(args:string[])=>execFileSync('openssl',args,{cwd:dir,stdio:'pipe'})
 try{
  openssl(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.pem','-days','1','-subj','/CN=Synthetic Test CA'])
  openssl(['req','-newkey','rsa:2048','-nodes','-keyout','signer.key','-out','signer.csr','-subj','/UID=pass.invalid.thabaat.test/OU=TESTTEAM01/CN=Synthetic Test Pass'])
  openssl(['x509','-req','-in','signer.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-out','signer.pem','-days','1'])
  const fixture:WalletConfig={passTypeIdentifier:'pass.invalid.thabaat.test',teamIdentifier:'TESTTEAM01',organizationName:'Synthetic Thabaat',supportContact:'Local test only',signerCert:readFileSync(join(dir,'signer.pem'),'utf8'),signerKey:readFileSync(join(dir,'signer.key'),'utf8'),wwdr:readFileSync(join(dir,'ca.pem'),'utf8')}
  assert.equal(validateWalletConfig(fixture),false)
  const bytes=generateWalletPass(ticket,fixture);assert.equal(bytes.subarray(0,2).toString(),'PK');writeFileSync(join(dir,'test.pkpass'),bytes)
  execFileSync('unzip',['-q','test.pkpass','-d','pass'],{cwd:dir})
  const manifest=JSON.parse(readFileSync(join(dir,'pass/manifest.json'),'utf8'))
  const files=readdirSync(join(dir,'pass')).filter(f=>f!=='signature'&&f!=='manifest.json')
  assert.deepEqual(Object.keys(manifest).sort(),files.sort())
  for(const name of files)assert.equal(manifest[name],createHash('sha1').update(readFileSync(join(dir,'pass',name))).digest('hex'))
  const pass=JSON.parse(readFileSync(join(dir,'pass/pass.json'),'utf8'));assert.equal(pass.eventTicket.primaryFields[0].value,ticket.title);assert.equal(pass.barcodes[0].message,ticket.token);assert.equal(pass.webServiceURL,undefined);assert.equal(pass.authenticationToken,undefined)
  openssl(['cms','-verify','-binary','-inform','DER','-in','pass/signature','-content','pass/manifest.json','-CAfile','ca.pem','-purpose','any','-out','verified.json'])
  assert.deepEqual(readFileSync(join(dir,'verified.json')),readFileSync(join(dir,'pass/manifest.json')))
  writeFileSync(join(dir,'tampered.json'),'{"tampered":true}')
  assert.throws(()=>openssl(['cms','-verify','-binary','-inform','DER','-in','pass/signature','-content','tampered.json','-CAfile','ca.pem','-purpose','any','-out','bad.json']))
 }finally{rmSync(dir,{recursive:true,force:true})}
})
