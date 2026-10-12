import { Router } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from 'express-rate-limit'
import { verifyAuth } from '../middleware/auth'
export type MediaAuthorize = (token:string,id:string)=>Promise<string|null>
export async function authorizeMediaRpc(token:string,id:string):Promise<string|null> {
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_KEY
 if(!url||!key)throw new Error('Not configured')
 // Authorization overrides the server API key: PostgREST executes the RPC as the verified caller.
 const caller=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await caller.rpc('get_media_playback_path',{p_id:id})
 if(error){if(error.code==='P0001')return null;throw error}
 return typeof data==='string'?data:null
}
export function createMediaRouter(client:SupabaseClient|null,check:MediaAuthorize=authorizeMediaRpc){
 const router=Router()
 router.use(rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}))
 router.use(verifyAuth(client))
 router.post('/playback',async(req,res)=>{
  const body=req.body??{},id=body.mediaId
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||Object.keys(body).some(k=>k!=='mediaId'&&k!=='purpose')||(body.purpose!==undefined&&body.purpose!=='cast'))return res.status(400).json({error:'Provide only a valid mediaId'})
  // A Chromecast streams the whole video from the link, so casting gets a 2-hour link; in-app playback stays at 60 s.
  const ttl=body.purpose==='cast'?7200:60
  res.setHeader('Cache-Control','no-store')
  try{
   const token=/^Bearer\s+(\S+)$/i.exec(req.headers.authorization!)![1]
   const path=await check(token,id)
   if(!path)return res.status(403).json({error:'Media access denied'})
   if(!/^[A-Za-z0-9][A-Za-z0-9/_-]*\.(mp4|mov)$/.test(path)||path.includes('..'))return res.status(503).json({error:'Media is not configured correctly'})
   const {data,error}=await client!.storage.from('thabaat-media').createSignedUrl(path,ttl)
   if(error||!data?.signedUrl)return res.status(503).json({error:'Media could not open'})
   return res.json({url:data.signedUrl,expiresIn:ttl})
  }catch{return res.status(503).json({error:'Secure playback is unavailable'})}
 })
 return router
}
