import {createHash,createPrivateKey,createPublicKey,X509Certificate} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {PKPass} from 'passkit-generator'
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type WalletTicket={registration_id:string;event_id:string;title:string;event_date:string;location:string|null;ticket_name:string;token:string}
export type WalletConfig={passTypeIdentifier:string;teamIdentifier:string;organizationName:string;supportContact:string;signerCert:string;signerKey:string;wwdr:string;signerKeyPassphrase?:string}
const assets=join(__dirname,'assets')
const roots=['apple-root.cer','apple-root-g2.cer','apple-root-g3.cer'].map(f=>new X509Certificate(readFileSync(join(assets,f))))
const icons=Object.fromEntries(['icon.png','icon@2x.png','icon@3x.png'].map(f=>[f,readFileSync(join(assets,f))]))
const field=(cert:X509Certificate,key:string)=>cert.subject.split('\n').find(line=>line.startsWith(`${key}=`))?.slice(key.length+1)
const current=(cert:X509Certificate,now:number)=>Date.parse(cert.validFrom)<=now&&Date.parse(cert.validTo)>now
// Trusted anchors are fixed public Apple roots; configuration cannot add a new trust root.
export function validateWalletConfig(config:WalletConfig,now=Date.now()):boolean {
 try {
  if(!/^pass\.[A-Za-z0-9.-]+$/.test(config.passTypeIdentifier)||!/^[A-Z0-9]{10}$/.test(config.teamIdentifier))return false
  if(!config.organizationName?.trim()||config.organizationName.length>80||!config.supportContact?.trim()||config.supportContact.length>240)return false
  const cert=new X509Certificate(config.signerCert),wwdr=new X509Certificate(config.wwdr)
  if(cert.ca||!wwdr.ca||field(cert,'UID')!==config.passTypeIdentifier||field(cert,'OU')!==config.teamIdentifier)return false
  if(!current(cert,now)||!current(wwdr,now)||!cert.checkIssued(wwdr)||!cert.verify(wwdr.publicKey))return false
  if(!roots.some(root=>current(root,now)&&wwdr.checkIssued(root)&&wwdr.verify(root.publicKey)))return false
  const key=createPrivateKey({key:config.signerKey,passphrase:config.signerKeyPassphrase})
  // passkit-generator currently signs RSA PKCS7 passes.
  if(key.asymmetricKeyType!=='rsa')return false
  return createPublicKey(key).export({type:'spki',format:'der'}).equals(cert.publicKey.export({type:'spki',format:'der'}))
 }catch{return false}
}
export function loadWalletConfig(env:NodeJS.ProcessEnv=process.env):WalletConfig|null {
 const decode=(name:string)=>env[name]?Buffer.from(env[name]!, 'base64').toString('utf8'):''
 const config:WalletConfig={passTypeIdentifier:env.WALLET_PASS_TYPE_IDENTIFIER||'',teamIdentifier:env.WALLET_TEAM_IDENTIFIER||'',organizationName:env.WALLET_ORGANIZATION_NAME||'',supportContact:env.WALLET_SUPPORT_CONTACT||'',signerCert:decode('WALLET_SIGNER_CERT_BASE64'),signerKey:decode('WALLET_SIGNER_KEY_BASE64'),wwdr:decode('WALLET_WWDR_CERT_BASE64'),signerKeyPassphrase:env.WALLET_SIGNER_KEY_PASSPHRASE}
 return validateWalletConfig(config)?config:null
}
export function validWalletTicket(value:unknown,id:string):value is WalletTicket {
 const t=value as WalletTicket
 return Boolean(t&&t.registration_id===id&&UUID.test(t.event_id)&&typeof t.token==='string'&&/^[0-9a-f]{64}$/.test(t.token)&&typeof t.title==='string'&&t.title.trim()&&t.title.length<=200&&typeof t.ticket_name==='string'&&t.ticket_name.length<=200&&(t.location===null||(typeof t.location==='string'&&t.location.length<=500))&&typeof t.event_date==='string'&&Number.isFinite(Date.parse(t.event_date)))
}
// Call only after caller-scoped entitlement RPC; signing material never enters JSON or logs.
export function generateWalletPass(ticket:WalletTicket,config:WalletConfig):Buffer {
 const pass=new PKPass(icons,{wwdr:config.wwdr,signerCert:config.signerCert,signerKey:config.signerKey,signerKeyPassphrase:config.signerKeyPassphrase},{formatVersion:1,passTypeIdentifier:config.passTypeIdentifier,teamIdentifier:config.teamIdentifier,organizationName:config.organizationName,description:'Event ticket for '+ticket.title,serialNumber:createHash('sha256').update(ticket.registration_id+':'+ticket.token).digest('hex'),logoText:config.organizationName,backgroundColor:'rgb(30, 51, 40)',foregroundColor:'rgb(242, 238, 227)',labelColor:'rgb(230, 223, 204)',sharingProhibited:true})
 pass.type='eventTicket'
 pass.primaryFields.push({key:'event',label:'EVENT',value:ticket.title})
 pass.secondaryFields.push({key:'ticket',label:'TICKET',value:ticket.ticket_name})
 pass.auxiliaryFields.push({key:'date',label:'WHEN',value:new Date(ticket.event_date).toISOString(),dateStyle:'PKDateStyleMedium',timeStyle:'PKDateStyleShort'})
 if(ticket.location)pass.auxiliaryFields.push({key:'venue',label:'WHERE',value:ticket.location})
 pass.backFields.push({key:'support',label:'CONTACT',value:config.supportContact},{key:'admission',label:'ADMISSION',value:'Admission requires online ticket validation. Canceled or transferred tickets and inactive member entitlements cannot be used. Download a new pass after changes.'})
 pass.setBarcodes({format:'PKBarcodeFormatQR',message:ticket.token,messageEncoding:'iso-8859-1'})
 pass.setRelevantDate(new Date(ticket.event_date))
 pass.setExpirationDate(new Date(Date.parse(ticket.event_date)+86400000))
 return pass.getAsBuffer()
}
