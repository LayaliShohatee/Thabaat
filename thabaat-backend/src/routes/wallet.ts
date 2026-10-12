import {Router} from 'express'
import {rateLimit} from 'express-rate-limit'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {verifyAuth} from '../middleware/auth'
import {UUID,loadWalletConfig,validWalletTicket,generateWalletPass,type WalletConfig,type WalletTicket} from '../wallet/pass'
export type WalletAuthorize=(token:string,id:string)=>Promise<unknown|null>
export async function authorizeWalletRpc(token:string,id:string):Promise<unknown|null>{
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_KEY
 if(!url||!key)throw new Error('Not configured')
 const caller=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await caller.rpc('get_my_ticket',{p_registration_id:id})
 if(error){if(error.code==='P0001')return null;throw error}
 return data
}
export type WalletOptions={config?:()=>WalletConfig|null;authorize?:WalletAuthorize;sign?:(ticket:WalletTicket,config:WalletConfig)=>Buffer}
export function createWalletRouter(client:SupabaseClient|null,options:WalletOptions={}){
 const router=Router(),config=options.config||loadWalletConfig,authorize=options.authorize||authorizeWalletRpc,sign=options.sign||generateWalletPass
 router.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');res.setHeader('Pragma','no-cache');res.setHeader('Referrer-Policy','no-referrer');next()})
 router.use(verifyAuth(client))
 // Per verified identity; no ticket or token is used as a response header/log key.
 router.use(rateLimit({windowMs:60000,limit:10,keyGenerator:(_req,res)=>res.locals.userId,standardHeaders:'draft-6',legacyHeaders:false}))
 router.get('/status',(_req,res)=>res.json({available:Boolean(config())}))
 router.post('/pass',async(req,res)=>{
  const body=req.body??{},id=body.registrationId
  if(typeof id!=='string'||!UUID.test(id)||Object.keys(body).some(k=>k!=='registrationId'))return res.status(400).json({error:'Provide only a valid registrationId'})
  const signing=config()
  if(!signing)return res.status(503).json({error:'Apple Wallet signing is not configured'})
  try{
   const token=/^Bearer\s+(\S+)$/i.exec(req.headers.authorization!)![1]
   const ticket=await authorize(token,id)
   if(!ticket)return res.status(403).json({error:'Confirmed ticket access denied'})
   if(!validWalletTicket(ticket,id))return res.status(503).json({error:'Ticket data is unavailable'})
   const pass=sign(ticket,signing)
   res.setHeader('Content-Type','application/vnd.apple.pkpass');res.setHeader('Content-Disposition','attachment; filename="ticket.pkpass"')
   return res.send(pass)
  }catch{return res.status(503).json({error:'Apple Wallet pass is unavailable'})}
 })
 return router
}
