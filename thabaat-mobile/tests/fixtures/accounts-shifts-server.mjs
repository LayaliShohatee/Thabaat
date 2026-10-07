// Two-account, loopback-only browser fixture. Never forwards requests to hosted services.
import http from 'node:http'
const host='127.0.0.1',port=54332
const accounts=[{id:'00000000-0000-0000-0000-000000000001',email:'sender@example.invalid',name:'Fixture Sender'},{id:'00000000-0000-0000-0000-000000000002',email:'recipient@example.invalid',name:'Fixture Recipient'}]
const userFor=a=>({id:a.id,email:a.email,aud:'authenticated',role:'authenticated',user_metadata:{full_name:a.name},app_metadata:{provider:'email'},created_at:new Date().toISOString()})
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url')
const session=a=>{const exp=Math.floor(Date.now()/1000)+3600;return{access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:a.id,exp,role:'authenticated'})}.local-fixture`,refresh_token:a.id,expires_in:3600,expires_at:exp,token_type:'bearer',user:userFor(a)}}
const event={id:'10000000-0000-0000-0000-000000000001',title:'Synthetic gift event',event_date:new Date(Date.now()+2*86400000).toISOString(),location:'Local fixture venue',description:'Synthetic gift acceptance only.',capacity:1,members_only:false}
const ticket={id:'20000000-0000-0000-0000-000000000001',event_id:event.id,name:'Free admission',price:0,quantity:1}
const regs=[{id:'30000000-0000-0000-0000-000000000001',user_id:accounts[0].id,event_id:event.id,ticket_type_id:ticket.id,status:'confirmed',created_at:new Date().toISOString(),token:'abc12345'.repeat(8)}]
const gifts=[]
let suspended=false,revision=0;const audit=[];let arrived=null,departed=null
const shift={event_id:event.id,title:'Synthetic volunteer shift',duty:'Welcome desk',active:true,shift_start:new Date(Date.now()-600000).toISOString(),shift_end:new Date(Date.now()+3600000).toISOString(),reviewed_hours:0}

const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,OPTIONS');res.setHeader('Content-Type','application/json')
 const send=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value))}
 if(req.method==='OPTIONS')return send(204,null)
 const url=new URL(req.url,`http://${host}:${port}`);let raw='';for await(const part of req)raw+=part;const data=raw?JSON.parse(raw):{}
 if(url.pathname==='/health')return send(200,{fixture:true})
 if(url.pathname==='/auth/v1/token'){const a=url.searchParams.get('grant_type')==='refresh_token'?accounts.find(a=>a.id===data.refresh_token):accounts.find(a=>a.email===data.email&&data.password==='local-demo-password');return a?send(200,session(a)):send(400,{msg:'Invalid login credentials',error_code:'invalid_credentials'})}
 let account;try{const token=(req.headers.authorization||'').replace(/^Bearer /,'');const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());account=accounts.find(a=>a.id===claims.sub)}catch{}
 if(!account)return send(401,{message:'Sign in required'})
 if(url.pathname==='/auth/v1/user')return send(200,userFor(account))
 if(url.pathname==='/auth/v1/logout')return send(200,{})
 if(url.pathname==='/rest/v1/profiles')return send(200,{id:account.id,email:account.email,full_name:account.name})
 if(url.pathname==='/rest/v1/rpc/admin_account_controls'){if(account!==accounts[0])return send(400,{message:'Administrator required'});return send(200,{accounts:[{user_id:accounts[1].id,full_name:accounts[1].name,staff_role:'volunteer',suspended,revision}],history:audit})}
 if(url.pathname==='/rest/v1/rpc/set_account_suspension'){if(account!==accounts[0])return send(400,{message:'Administrator required'});if(data.p_revision!==revision)return send(400,{message:'Account changed; refresh before reviewing'});suspended=data.p_suspended;revision++;audit.unshift({id:String(revision),target_id:accounts[1].id,suspended,reason:data.p_reason,revision,recorded_at:new Date().toISOString()});return send(200,null)}
 if(url.pathname==='/rest/v1/rpc/my_volunteer_work')return send(200,{application:{motivation:'Synthetic volunteer application',status:'approved'},assignments:[]})
 if(url.pathname==='/rest/v1/rpc/my_volunteer_attendance'){if(suspended&&account===accounts[1])return send(400,{message:'Account suspended. Contact Thabaat support for review.'});return send(200,account===accounts[1]?[{...shift,arrived_at:arrived,departed_at:departed}]:[])}
 if(url.pathname==='/rest/v1/rpc/record_volunteer_attendance'){if(suspended||account!==accounts[1])return send(400,{message:'Active volunteer required'});if(data.p_action==='arrive')arrived??=new Date().toISOString();else{if(!arrived)return send(400,{message:'Record arrival first'});departed??=new Date().toISOString()}return send(200,{...shift,arrived_at:arrived,departed_at:departed})}
 if(url.pathname==='/rest/v1/rpc/my_permissions')return send(200,{user_id:account.id,staff_role:account===accounts[0]?'admin':'volunteer',can_manage_events:account===accounts[0],can_manage_roles:account===accounts[0],paid_member:false})
 if(url.pathname==='/rest/v1/rpc/my_free_ticket_gifts')return send(200,{gifts:gifts.filter(g=>g.sender_id===account.id||g.recipient_id===account.id),registrations:regs.filter(r=>r.user_id===account.id&&r.status==='confirmed').map(r=>({id:r.id,event_id:event.id,title:event.title,event_date:event.event_date,ticket_name:ticket.name,members_only:false}))})
 if(url.pathname==='/rest/v1/rpc/begin_free_ticket_gift'){
  const old=gifts.find(g=>g.request_id===data.p_request_id);if(old)return send(200,old)
  const r=regs.find(r=>r.id===data.p_registration_id&&r.user_id===account.id&&r.status==='confirmed'),target=accounts.find(a=>a.id===data.p_recipient_id)
  if(!r||!target||target.id===account.id)return send(400,{message:'Choose a different known existing account ID'})
  if(gifts.some(g=>g.registration_id===r.id&&g.status==='pending'))return send(400,{message:'Revoke the current gift before choosing another recipient'})
  const g={id:'40000000-0000-0000-0000-'+String(gifts.length+1).padStart(12,'0'),registration_id:r.id,event_id:event.id,ticket_type_id:ticket.id,sender_id:account.id,recipient_id:target.id,sender_name:account.name,recipient_name:target.name,recipient_registration_id:null,status:'pending',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),request_id:data.p_request_id,title:event.title,event_date:event.event_date,members_only:false};gifts.push(g);return send(200,g)
 }
 if(url.pathname==='/rest/v1/rpc/accept_free_ticket_gift'){
  const g=gifts.find(g=>g.id===data.p_gift_id&&g.recipient_id===account.id)
  if(!g)return send(400,{message:'Gift not found'})
  if(g.status==='accepted')return send(200,g)
  if(g.status!=='pending'||Date.parse(g.expires_at)<=Date.now())return send(400,{message:'Gift is no longer available'})
  const source=regs.find(r=>r.id===g.registration_id&&r.status==='confirmed')
  if(!source)return send(400,{message:'Sender ticket is no longer eligible'})
  source.status='cancelled';source.token=null;const received={id:'30000000-0000-0000-0000-000000000002',user_id:account.id,event_id:event.id,ticket_type_id:ticket.id,status:'confirmed',created_at:new Date().toISOString(),token:'def67890'.repeat(8)};regs.push(received);g.status='accepted';g.recipient_registration_id=received.id;return send(200,g)
 }
 if(url.pathname==='/rest/v1/rpc/resolve_free_ticket_gift'){
  const g=gifts.find(g=>g.id===data.p_gift_id&&(g.sender_id===account.id||g.recipient_id===account.id))
  if(!g)return send(400,{message:'Gift not found'})
  if(data.p_action==='revoked'&&g.sender_id!==account.id||data.p_action==='declined'&&g.recipient_id!==account.id)return send(400,{message:'Gift action not permitted'})
  if(g.status===data.p_action)return send(200,null)
  if(g.status!=='pending')return send(400,{message:'Gift is already resolved'})
  g.status=data.p_action;return send(200,null)
 }
 if(url.pathname==='/rest/v1/rpc/get_my_ticket'){
  const r=regs.find(r=>r.id===data.p_registration_id&&r.user_id===account.id&&r.status==='confirmed')
  return r?send(200,{registration_id:r.id,event_id:event.id,title:event.title,event_date:event.event_date,location:event.location,ticket_name:ticket.name,token:r.token,checked_in_at:null}):send(400,{message:'Confirmed ticket not found'})
 }
 if(url.pathname==='/rest/v1/events')return send(200,url.searchParams.has('id')?{...event,ticket_types:[ticket]}:[event])
 if(url.pathname==='/rest/v1/registrations')return send(200,regs.filter(r=>r.user_id===account.id).map(r=>({...r,event,ticket_type:ticket})))
 if(url.pathname==='/rest/v1/memberships')return send(200,null)
 if(['/rest/v1/membership_plans','/rest/v1/donation_campaigns','/rest/v1/payment_records'].includes(url.pathname))return send(200,[])
 return send(404,{message:'Fixture endpoint not implemented'})
})
server.listen(port,host,()=>console.log(`Local two-account gifting fixture ${host}:${port}; sender@example.invalid and recipient@example.invalid / local-demo-password`))
