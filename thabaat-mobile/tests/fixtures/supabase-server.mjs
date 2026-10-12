// Local-only UI smoke-test fixture. Never forwards requests to Supabase or Expo.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
const host = '127.0.0.1'
const port = 54329
const paidFixture = process.env.FIXTURE_PAID_EVENT === 'true'
const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid', user_metadata: { full_name: 'Local Demo' }, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() }
const event = { id: '10000000-0000-0000-0000-000000000001', title: 'Local fixture community event', description: 'Synthetic event for local regression testing only.', event_date: new Date(Date.now() + 86400000 * 7).toISOString(), location: 'Local test venue', image_url: null, speaker_name: 'Demo speaker', capacity: 10, created_at: new Date().toISOString() }
const tickets = [{ id: '20000000-0000-0000-0000-000000000001', event_id: event.id, name: 'Free admission', price: 0, quantity: 10 }, { id: '20000000-0000-0000-0000-000000000002', event_id: event.id, name: 'Paid ticket unavailable', price: 10, quantity: 10 }]
if (paidFixture) {
 event.id = '71000000-0000-4000-8000-000000000001'
 event.title = 'Local fixture paid access test'
 tickets.splice(0, tickets.length, { id: '72000000-0000-4000-8000-000000000001', event_id: event.id, name: 'Paid test access', price: 1, quantity: 1 })
}
const mediaFixture = process.env.FIXTURE_MEDIA === 'true'
let mediaAllowed = false
const mediaProgress = new Map()
const mediaItems = mediaFixture ? [
 {id:'81000000-0000-4000-8000-000000000001',title:'LOCAL TEST: Open recording',description:'Generated solid-color video. Synthetic fixture only.',category:'Talks',object_path:'open.mp4',members_only:false,published:true,created_by:user.id,created_at:new Date().toISOString()},
 {id:'81000000-0000-4000-8000-000000000002',title:'LOCAL TEST: Member recording',description:'Synthetic protected playback fixture. Never a real membership.',category:'Training',object_path:'member.mp4',members_only:true,published:true,created_by:user.id,created_at:new Date().toISOString()}
] : []
const fixtureCampaigns=[]
const fixtureDonation={id:'80000000-0000-0000-0000-000000000001',full_name:'Synthetic donor',campaign:'Unattributed',description:'Local simulation only; not a payment',amount_cents:250,currency:'USD',paid_at:new Date(Date.now()-86400000).toISOString(),verified_at:new Date(Date.now()-3600000).toISOString()}
const registrations = []
let waitlist = null
let fixtureOtherOccupied = false
let preferences = {user_id:user.id,push_enabled:false,confirmations:false,membership_alerts:false,video_alerts:false,reminders:[],categories:[]}
const broadcastRequests=new Map()
let broadcastCounter=0
let paidOrder = null
let paymentAttempt = null
const session = () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const expires_at = Math.floor(Date.now() / 1000) + 3600
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expires_at, role: 'authenticated' })}.local-fixture`, refresh_token: 'local-fixture-refresh', expires_in: 3600, expires_at, token_type: 'bearer', user }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS')
  res.setHeader('Content-Type', 'application/json')
  const send = (code, value) => { res.statusCode = code; res.end(JSON.stringify(value)) }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  const url = new URL(req.url, `http://${host}:${port}`)
  let body = ''
  for await (const chunk of req) body += chunk
  const data = body ? JSON.parse(body) : {}
  if (mediaFixture && url.pathname==='/media/playback' && req.method==='POST') {
   const item=mediaItems.find(i=>i.id===data.mediaId)
   if(!item || (item.members_only&&!mediaAllowed))return send(403,{error:'Synthetic membership denied'})
   return send(200,{url:`http://${host}:${port}/storage/v1/object/sign/thabaat-media/local-media.mp4?token=local-only`,expiresIn:60})
  }
  if (url.pathname === '/rest/v1/media_items') return send(200,mediaItems)
  if (mediaFixture && url.pathname === '/__fixture/media-access' && req.method === 'POST') {mediaAllowed=data.allowed===true;return send(200,{allowed:mediaAllowed})}
  if (url.pathname === '/rest/v1/media_progress') {
   if(req.method==='POST'){mediaProgress.set(data.media_id,Number(data.seconds??0));return send(200,{})}
   const mediaId=url.searchParams.get('media_id')?.replace(/^eq\./,'')
   return send(200,{seconds:mediaProgress.get(mediaId)??0})
  }
  if (mediaFixture && req.method==='POST' && url.pathname.startsWith('/storage/v1/object/sign/thabaat-media/')) {
   if(url.pathname.endsWith('/member.mp4')&&!mediaAllowed)return send(403,{message:'Synthetic membership denied'})
   return send(200,{signedURL:'/object/sign/thabaat-media/local-media.mp4?token=local-only'})
  }
  if (mediaFixture && url.pathname==='/storage/v1/object/sign/thabaat-media/local-media.mp4') {
   const video=await readFile(new URL('./local-media.mp4',import.meta.url))
   res.setHeader('Content-Type','video/mp4');res.setHeader('Accept-Ranges','bytes')
   const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??'')
   if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):video.length-1,video.length-1);if(start> end){res.statusCode=416;res.end();return}res.setHeader('Content-Range',`bytes ${start}-${end}/${video.length}`);res.setHeader('Content-Length',end-start+1);res.statusCode=206;res.end(video.subarray(start,end+1));return}
   res.setHeader('Content-Length',video.length);res.statusCode=200;res.end(video);return
  }
  if(url.pathname === '/rest/v1/rpc/admin_analytics') {
   if(process.env.FIXTURE_STAFF!=='true')return send(403,{message:'Administrator required'})
   if(![7,30,90].includes(data.p_days))return send(400,{message:'Choose 7, 30 or 90 days'})
   const asOf=new Date(),since=new Date(asOf.getTime()-data.p_days*86400000)
   const days=Array.from({length:data.p_days+1},(_,n)=>({day:new Date(since.getTime()+n*86400000).toISOString().slice(0,10),new_users:n===data.p_days?1:0,new_registrations:n===data.p_days?registrations.length:0}))
   return send(200,{as_of:asOf.toISOString(),days:data.p_days,since:since.toISOString(),users:{total:1,new:1},memberships:{current_verified:0,complimentary_current:0},events:{upcoming:1,archived:0},registrations:{confirmed:registrations.filter(r=>r.status==='confirmed').length,cancelled:registrations.filter(r=>r.status==='cancelled').length,new:registrations.length,checked_in:0},verified_payments:[],daily:days})
  }
  if(url.pathname === '/rest/v1/rpc/campaign_listing') return send(200,fixtureCampaigns.filter(c=>c.published&&!c.archived).map(c=>({...c,raised_cents:0})).sort((a,b)=>Number(b.featured)-Number(a.featured)))
  if(url.pathname === '/rest/v1/rpc/admin_campaign_catalog') return process.env.FIXTURE_STAFF==='true'?send(200,fixtureCampaigns):send(403,{message:'Administrator required'})
  if(url.pathname === '/rest/v1/rpc/save_campaign') {
   if(process.env.FIXTURE_STAFF!=='true')return send(403,{message:'Administrator required'})
   if(data.p_reason.trim().length<5)return send(400,{message:'Check campaign audit reason'})
   if(data.p_published&&!/^https:\/\/(www\.)?charitystack\.com\/donate\/[a-zA-Z0-9-]+\/?$/.test(data.p_checkout_url))return send(400,{message:'Use an approved public CharityStack donation form URL'})
   if(data.p_featured&&!data.p_published)return send(400,{message:'Publish a campaign before featuring it'})
   const existing=fixtureCampaigns.find(c=>c.id===data.p_id)
   if(data.p_id&&(!existing||existing.revision!==data.p_revision))return send(400,{message:'Campaign changed. Refresh before saving'})
   if(data.p_featured)fixtureCampaigns.filter(c=>c.id!==data.p_id&&c.featured).forEach(c=>{c.featured=false;c.revision++})
   const c=existing||{id:'90000000-0000-0000-0000-'+String(fixtureCampaigns.length+1).padStart(12,'0'),archived:false,revision:0,raised_cents:0};Object.assign(c,{name:data.p_name,description:data.p_description,checkout_url:data.p_checkout_url,recurring_available:data.p_recurring,goal_cents:data.p_goal_cents,published:data.p_published,featured:data.p_featured,revision:c.revision+1});if(!existing)fixtureCampaigns.push(c);return send(200,c)
  }
  if(url.pathname === '/rest/v1/rpc/archive_campaign') {
   if(process.env.FIXTURE_STAFF!=='true')return send(403,{message:'Administrator required'})
   const c=fixtureCampaigns.find(c=>c.id===data.p_id);if(!c||c.revision!==data.p_revision)return send(400,{message:'Campaign changed. Refresh before archiving'});Object.assign(c,{archived:true,published:false,featured:false,revision:c.revision+1});return send(200,null)
  }
  if(url.pathname === '/rest/v1/rpc/admin_donation_report') return process.env.FIXTURE_STAFF==='true'?send(200,{records:data.p_offset?[]:[fixtureDonation],total:1,cutoff:data.p_before||new Date().toISOString()}):send(403,{message:'Administrator required'})
  if(url.pathname === '/rest/v1/rpc/managed_ticket_types') return send(200,tickets.map(t=>({...t,reserved:registrations.filter(r=>r.ticket_type_id===t.id&&r.status!=='cancelled').length})))
  if(url.pathname === '/rest/v1/rpc/save_free_ticket_type') {
   if(process.env.FIXTURE_STAFF!=='true')return send(403,{message:'Event management not permitted'})
   const existing=tickets.find(t=>t.id===data.p_id)
   if(existing&&existing.price!==0)return send(400,{message:'Only free ticket inventory can be edited here'})
   if(existing&&data.p_quantity<registrations.filter(r=>r.ticket_type_id===existing.id&&r.status!=='cancelled').length)return send(400,{message:'Quantity cannot be below registrations and reserved seats'})
   const ticket=existing||{id:'20000000-0000-0000-0000-'+String(tickets.length+1).padStart(12,'0'),event_id:event.id,price:0};Object.assign(ticket,{name:data.p_name,description:data.p_description,quantity:data.p_quantity});if(!existing)tickets.push(ticket);return send(200,ticket.id)
  }
  if(['/rest/v1/rpc/review_notification_broadcast','/rest/v1/rpc/new_notification_broadcast_id','/rest/v1/rpc/queue_notification_broadcast'].includes(url.pathname)) {
   if(process.env.FIXTURE_STAFF!=='true')return send(403,{message:'Administrator required'})
   if(url.pathname.endsWith('new_notification_broadcast_id'))return send(200,`90000000-0000-4000-8000-${String(++broadcastCounter).padStart(12,'0')}`)
   if(!['men','women','young_professionals','volunteer','conferences'].includes(data.p_category))return send(400,{message:'Choose an approved category'})
   if(data.p_event_id&&data.p_event_id!==event.id)return send(400,{message:'Event unavailable'})
   if(data.p_volunteer_only&&!data.p_event_id)return send(400,{message:'Choose an event for assigned-volunteer targeting'})
   const eligible=!data.p_volunteer_only&&preferences.push_enabled&&preferences.categories.includes(data.p_category)&&(!data.p_members_only||mediaAllowed)&&(!data.p_event_id||registrations.some(r=>r.status==='confirmed'))?1:0
   if(url.pathname.endsWith('review_notification_broadcast'))return send(200,eligible)
   if(!data.p_id||!data.p_title||!data.p_body)return send(400,{message:'Enter message and request identifier'})
   const prior=broadcastRequests.get(data.p_id)
   if(prior){if(prior.payload!==JSON.stringify(data))return send(400,{message:'Broadcast request identifier was already used'});return send(200,prior.eligible)}
   broadcastRequests.set(data.p_id,{payload:JSON.stringify(data),eligible});return send(200,eligible)
  }
  if(url.pathname === '/rest/v1/rpc/my_permissions') return send(200,{user_id:user.id,staff_role:process.env.FIXTURE_STAFF==='true'?'admin':null,can_manage_events:process.env.FIXTURE_STAFF==='true',can_manage_roles:process.env.FIXTURE_STAFF==='true',paid_member:false})
  if(url.pathname === '/rest/v1/rpc/save_event_details') {
   if(process.env.FIXTURE_STAFF!=='true')return send(403,{message:'Organizer or administrator required'})
   if(data.p_details.timezone && !['America/Detroit','UTC'].includes(data.p_details.timezone))return send(400,{message:'Choose a valid IANA timezone'})
   Object.assign(event,data.p_details,{title:data.p_title,description:data.p_description,event_date:data.p_date,location:data.p_location,capacity:data.p_capacity,created_by:user.id});return send(200,event.id)
  }
  if (url.pathname === '/health') return send(200, { fixture: true })
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'refresh_token' || (data.email === user.email && data.password === 'local-demo-password')) return send(200, session())
    return send(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
  }
  if (url.pathname === '/auth/v1/user') {
    if (req.method === 'PUT' && data.data) Object.assign(user.user_metadata, data.data)
    return send(200, user)
  }
  if (url.pathname === '/auth/v1/logout') return send(200, {})
  // Synthetic local-only billing state. Never connected to CharityStack.
  if (url.pathname === '/__fixture/payment-status' && req.method === 'POST') {
    if (!paymentAttempt || !['completed','failed','refunded','pending'].includes(data.status)) return send(400, { error: 'Create fixture checkout first' })
    paymentAttempt.status = data.status
    paymentAttempt.provider_payment_id = data.status === 'pending' ? null : 'LOCAL-SIMULATION-NOT-A-PAYMENT'
    paymentAttempt.verified_at = data.status === 'pending' ? null : new Date().toISOString()
    return send(200, { fixture: true })
  }
  if (paidFixture && url.pathname === '/__fixture/paid-event-status' && req.method === 'POST') {
    if (!paidOrder || !['completed','refunded'].includes(data.status)) return send(400,{error:'Prepare fixture order first'})
    paidOrder.status = data.status
    if (data.status === 'completed' && !registrations.length) registrations.push({ id:'30000000-0000-0000-0000-000000000001', user_id:user.id,event_id:event.id,ticket_type_id:tickets[0].id,status:'confirmed',created_at:new Date().toISOString() })
    return send(200,{fixture:true})
  }
  if (paidFixture && url.pathname === '/rest/v1/rpc/begin_paid_event_checkout') {
    paidOrder ??= { id:'50000000-0000-0000-0000-000000000001',event_id:event.id,ticket_type_id:tickets[0].id,form_id:'5451350b-cef4-4e59-8240-aa457d4f7c7e',amount_cents:100,currency:'USD',status:'pending' }
    return send(200,paidOrder)
  }
  if (url.pathname === '/rest/v1/paid_event_orders') return send(200,paidOrder)
  if (url.pathname === '/rest/v1/event_access_details') return send(200,paidOrder?.status === 'completed' ? {access_text:'LOCAL SIMULATION: paid event access unlocked.'} : null)
  if (url.pathname === '/rest/v1/rpc/begin_internal_payment_check') {
    paymentAttempt ??= { id: '40000000-0000-0000-0000-000000000001', status: 'pending', provider_payment_id: null, verified_at: null, expected_amount_cents: 100 }
    return send(200, paymentAttempt)
  }
  if (url.pathname === '/rest/v1/checkout_attempts') return send(200, paymentAttempt)
  if (url.pathname === '/rest/v1/memberships') return send(200, null)
  if (['/rest/v1/membership_plans','/rest/v1/donation_campaigns','/rest/v1/payment_records'].includes(url.pathname)) return send(200, [])
  if(url.pathname==='/__fixture/waitlist-occupied'&&req.method==='POST'){fixtureOtherOccupied=!!data.occupied;return send(200,{fixture:true})}
  if(url.pathname==='/rest/v1/event_waitlist')return send(200,waitlist)
  if(url.pathname==='/rest/v1/rpc/join_event_waitlist'){
   if(!fixtureOtherOccupied)return send(400,{message:'A seat is available; register directly'})
   if(registrations.some(r=>r.status==='confirmed'))return send(400,{message:'Already registered'})
   waitlist??={id:'60000000-0000-0000-0000-000000000001',event_id:event.id,ticket_type_id:tickets[0].id,status:'waiting',joined_at:new Date().toISOString(),offer_expires_at:null}
   if(waitlist.status==='left')waitlist.status='waiting'
   return send(200,waitlist)
  }
  if(url.pathname==='/rest/v1/rpc/leave_event_waitlist'){if(waitlist){waitlist.status='left';waitlist.offer_expires_at=null}return send(200,null)}
  if(url.pathname==='/rest/v1/rpc/manage_event_waitlist')return send(200,waitlist?[{...waitlist,full_name:'Local Demo',ticket_name:tickets[0].name}]:[])
  if(url.pathname==='/rest/v1/rpc/offer_next_waitlist_seat'){
   if(fixtureOtherOccupied)return send(400,{message:'No seat available to offer'})
   if(!waitlist||waitlist.status!=='waiting')return send(400,{message:'No eligible waiting attendee'})
   waitlist.status='offered';waitlist.offer_expires_at=data.p_expires_at;return send(200,waitlist)
  }
  if(url.pathname==='/rest/v1/rpc/accept_waitlist_offer'){
   if(!waitlist||waitlist.status!=='offered'||Date.parse(waitlist.offer_expires_at)<=Date.now())return send(400,{message:'No valid seat offer'})
   waitlist.status='accepted';waitlist.offer_expires_at=null
   const row={user_id:user.id,event_id:event.id,ticket_type_id:tickets[0].id,id:'30000000-0000-0000-0000-000000000001',status:'confirmed',created_at:new Date().toISOString()}
   if(!registrations.length)registrations.push(row);else registrations[0].status='confirmed';return send(200,registrations[0])
  }
  if (url.pathname === '/rest/v1/notification_preferences') {
    if (req.method === 'POST' || req.method === 'PATCH') preferences = { ...preferences, ...data, user_id: user.id }
    return send(200, preferences)
  }
  if (url.pathname === '/rest/v1/rpc/get_my_ticket') {
    const row = registrations.find(r => r.id === data.p_registration_id && r.status === 'confirmed')
    if (!row) return send(403, {message: 'Confirmed ticket unavailable'})
    return send(200, {registration_id: row.id, event_id: row.event_id, title: event.title, event_date: event.event_date, location: event.location, ticket_name: tickets.find(t => t.id === row.ticket_type_id)?.name, token: 'f'.repeat(64), checked_in_at: null})
  }
  if (url.pathname === '/rest/v1/rpc/reserve_free_event') {
    if(fixtureOtherOccupied||waitlist?.status==='offered')return send(400,{message:'Event is sold out'})
    if (data.p_event_id !== event.id || data.p_ticket_type_id !== tickets[0].id || tickets[0].price !== 0) return send(400,{message:'Free ticket unavailable'})
    if (registrations.length) { registrations[0].status='confirmed'; registrations[0].ticket_type_id=tickets[0].id; return send(200,registrations[0]) }
    const row={user_id:user.id,event_id:event.id,ticket_type_id:tickets[0].id,id:'30000000-0000-0000-0000-000000000001',status:'confirmed',created_at:new Date().toISOString()}
    registrations.push(row); return send(200,row)
  }
  if (url.pathname === '/rest/v1/rpc/cancel_free_registration') {
    const row=registrations.find(r=>r.id===data.p_registration_id)
    if (!row || paidFixture) return send(400,{message:'Free registration not found'})
    row.status='cancelled'; return send(200,row)
  }
  if (url.pathname === '/rest/v1/events') {
    if (url.searchParams.has('id')) return send(200, url.searchParams.get('id') === `eq.${event.id}` ? { ...event, ticket_types: tickets } : null)
    return send(200, [event])
  }
  if (url.pathname === '/rest/v1/profiles') return send(200, { id: user.id, email: user.email, full_name: user.user_metadata.full_name })
  if (url.pathname === '/rest/v1/registrations') {
    if (req.method === 'POST') {
      if (registrations.length) return send(409, { code: '23505', message: 'Already registered for this event.' })
      if (data.ticket_type_id !== tickets[0].id) return send(400, { message: 'Paid checkout is not available yet.' })
      const row = { ...data, id: '30000000-0000-0000-0000-000000000001', status: 'confirmed', created_at: new Date().toISOString() }
      registrations.push(row)
      return send(201, row)
    }
    if (url.searchParams.has('event_id')) return send(200, registrations[0] ?? null)
    return send(200, registrations.map(row => ({ ...row, event, ticket_type: tickets[0] })))
  }
  return send(404, { message: 'Fixture endpoint not implemented' })
})
server.listen(port, host, () => console.log(`Local-only Supabase fixture: http://${host}:${port}. Login: demo@example.invalid / local-demo-password`))
