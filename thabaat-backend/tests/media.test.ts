import assert from 'node:assert/strict'
import {test} from 'node:test'
import express from 'express'
import type {SupabaseClient} from '@supabase/supabase-js'
import {createMediaRouter,authorizeMediaRpc,type MediaAuthorize} from '../src/routes/media'
const id='81000000-0000-4000-8000-000000000001'
async function request(body:unknown={mediaId:id},token:string|null='valid',check:MediaAuthorize=async()=> 'talks/video.mp4',fail=false){
 let signs=0
 const client={
  auth:{getUser:async(t:string)=>({data:{user:t==='valid'?{id:'user'}:null},error:null})},
  storage:{from:(bucket:string)=>{
   assert.equal(bucket,'thabaat-media')
   return {createSignedUrl:async(path:string,ttl:number)=>{
    signs++;assert.equal(path,'talks/video.mp4');assert.equal(ttl,60)
    return fail?{data:null,error:{message:'offline'}}:{data:{signedUrl:'https://fixture.invalid/video?token=synthetic'},error:null}
   }}
  }}
 } as unknown as SupabaseClient
 const app=express();app.use(express.json());app.use('/media',createMediaRouter(client,check));const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
 try{const port=(server.address() as {port:number}).port;const res=await fetch(`http://127.0.0.1:${port}/media/playback`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return{status:res.status,data:await res.json(),signs,cache:res.headers.get('cache-control')}}finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}
}
test('requires valid session before signing',async()=>{assert.equal((await request(undefined,null)).status,401);assert.equal((await request(undefined,'expired')).status,401)})
test('does not accept caller path, bucket, identity or expiry',async()=>{for(const key of ['path','bucket','userId','expiresIn']){const r=await request({mediaId:id,[key]:'forged'});assert.equal(r.status,400);assert.equal(r.signs,0)}})
test('denied membership never receives a signed URL',async()=>{const r=await request(undefined,'valid',async(token,mediaId)=>{assert.equal(token,'valid');assert.equal(mediaId,id);return null});assert.equal(r.status,403);assert.equal(r.signs,0)})
test('signs only checked database path for exactly60 seconds and forbids caching',async()=>{const r=await request();assert.equal(r.status,200);assert.equal(r.data.expiresIn,60);assert.equal(r.signs,1);assert.equal(r.cache,'no-store')})
test('database or storage failures fail closed',async()=>{assert.equal((await request(undefined,'valid',async()=>{throw new Error('offline')})).status,503);assert.equal((await request(undefined,'valid',async()=> 'talks/video.mp4',true)).status,503)})
test('unexpected database path never reaches signer',async()=>{const r=await request(undefined,'valid',async()=> '../../secret');assert.equal(r.status,503);assert.equal(r.signs,0)})

test('caller-scoped RPC sends user bearer rather than service bearer',async()=>{
 const previousUrl=process.env.SUPABASE_URL,previousKey=process.env.SUPABASE_SERVICE_KEY
 const app=express();app.use(express.json());app.post('/rest/v1/rpc/get_media_playback_path',(req,res)=>{
  assert.equal(req.headers.authorization,'Bearer caller-jwt')
  assert.equal(req.headers.apikey,'synthetic-server-api-key')
  assert.deepEqual(req.body,{p_id:id});res.json('talks/video.mp4')
 })
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
 try{process.env.SUPABASE_URL=`http://127.0.0.1:${(server.address() as {port:number}).port}`;process.env.SUPABASE_SERVICE_KEY='synthetic-server-api-key';assert.equal(await authorizeMediaRpc('caller-jwt',id),'talks/video.mp4')}
 finally{if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_KEY;else process.env.SUPABASE_SERVICE_KEY=previousKey;await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
