// Local-only UI smoke-test fixture. Never forwards requests to Supabase or Expo.
import http from 'node:http'
const host = '127.0.0.1'
const port = 54330
const paidFixture = process.env.FIXTURE_PAID_EVENT === 'true'
const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid', user_metadata: { full_name: 'Local Demo' }, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() }
const event = { id: '10000000-0000-0000-0000-000000000001', title: 'Local fixture community event', description: 'Synthetic event for local regression testing only.', event_date: new Date(Date.now() + 86400000 * 7).toISOString(), location: 'Local test venue', image_url: null, created_by: user.id, speaker_name: 'Demo speaker', capacity: 10, created_at: new Date().toISOString() }
const tickets = [{ id: '20000000-0000-0000-0000-000000000001', event_id: event.id, name: 'Free admission', price: 0, quantity: 10 }, { id: '20000000-0000-0000-0000-000000000002', event_id: event.id, name: 'Paid ticket unavailable', price: 10, quantity: 10 }]
if (paidFixture) {
 event.id = '71000000-0000-4000-8000-000000000001'
 event.title = 'Local fixture paid access test'
 tickets.splice(0, tickets.length, { id: '72000000-0000-4000-8000-000000000001', event_id: event.id, name: 'Paid test access', price: 1, quantity: 1 })
}
const registrations = []
let preferences = {user_id:user.id,push_enabled:false,confirmations:false,membership_alerts:false,video_alerts:false,reminders:[],categories:[]}
let adminPlans=[]
let adminMemberships=[]
let adminHistory=[]
let issuanceRequests=new Map()
let application = null
let shifts = []
let checkedAt=null
const ticketCode='abc12345'.repeat(8)
const helper = {user_id:'00000000-0000-0000-0000-000000000002',full_name:'Fixture Helper'}
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
  if(url.pathname === '/rest/v1/rpc/admin_membership_catalog') return send(200,adminPlans)
  if(url.pathname === '/rest/v1/rpc/search_role_accounts') return send(200,[{user_id:user.id,full_name:'Local Demo',email:user.email,staff_role:'admin'},{user_id:helper.user_id,full_name:helper.full_name,email:'helper@example.invalid',staff_role:null}].filter(a=>(a.full_name+' '+a.email).toLowerCase().includes(data.p_search.toLowerCase())))
  if(url.pathname === '/rest/v1/rpc/save_membership_plan') {
   if(data.p_name.length<3||data.p_reason.length<10)return send(400,{message:'Check plan name, benefits, terms and approval reason'})
   const previous=adminPlans.find(p=>p.id===data.p_id)
   const saved={id:data.p_id||'60000000-0000-0000-0000-'+String(adminPlans.length+1).padStart(12,'0'),name:data.p_name,description:data.p_description,benefits:data.p_benefits,acquisition_mode:data.p_mode,amount_cents:data.p_amount_cents,currency:'USD',billing_period:data.p_period,checkout_url:data.p_checkout_url,published:data.p_published,revision:(previous?.revision||0)+1}
   adminPlans=adminPlans.filter(p=>p.id!==saved.id);adminPlans.push(saved);adminHistory.unshift({id:String(Date.now()),target_user_id:null,plan_id:saved.id,action:'plan_saved',reason:data.p_reason,recorded_at:new Date().toISOString(),actor_name:'Local Demo',previous_record:previous||null,new_record:saved});return send(200,saved)
  }
  if(url.pathname === '/rest/v1/rpc/issue_complimentary_membership') {
   if(issuanceRequests.has(data.p_request_id))return send(200,issuanceRequests.get(data.p_request_id))
   const plan=adminPlans.find(p=>p.id===data.p_plan_id&&p.published&&p.acquisition_mode==='complimentary')
   if(!plan)return send(400,{message:'Select a published complimentary plan'})
   if(Date.parse(data.p_expires_at)<=Date.now())return send(400,{message:'Choose a future expiry and document the issuance reason'})
   const previous=adminMemberships.find(m=>m.user_id===data.p_user_id)
   const saved={id:'70000000-0000-0000-0000-000000000001',user_id:data.p_user_id,full_name:data.p_user_id===user.id?'Local Demo':'Fixture Helper',plan_id:plan.id,plan_name:plan.name,status:'active',source:'complimentary',starts_at:new Date().toISOString(),expires_at:data.p_expires_at,verified_at:new Date().toISOString(),cancel_at_period_end:false,provider_subscription_id:null,active:true}
   adminMemberships=adminMemberships.filter(m=>m.user_id!==saved.user_id);adminMemberships.push(saved);issuanceRequests.set(data.p_request_id,saved);adminHistory.unshift({id:String(Date.now()),target_user_id:saved.user_id,plan_id:plan.id,action:'complimentary_issued',reason:data.p_reason,recorded_at:new Date().toISOString(),actor_name:'Local Demo',previous_record:previous||null,new_record:saved});return send(200,saved)
  }
  if(url.pathname === '/rest/v1/rpc/revoke_complimentary_membership') {
   const m=adminMemberships.find(m=>m.user_id===data.p_user_id)
   if(!m||m.source!=='complimentary')return send(400,{message:'Complimentary membership not found'})
   const previous={...m};m.status='cancelled';m.active=false;adminHistory.unshift({id:String(Date.now()),target_user_id:m.user_id,plan_id:m.plan_id,action:'complimentary_revoked',reason:data.p_reason,recorded_at:new Date().toISOString(),actor_name:'Local Demo',previous_record:previous,new_record:{...m}});return send(200,null)
  }
  if(url.pathname === '/rest/v1/rpc/admin_membership_report') {const rows=adminMemberships.filter(m=>!data.p_search||m.full_name.toLowerCase().includes(data.p_search.toLowerCase())||m.user_id===data.p_search);return send(200,{memberships:rows,history:adminHistory,history_limit:100,counts:{recorded:rows.length,active:rows.filter(m=>m.active).length,past_due:0,ending_30_days:0}})}
  if(url.pathname === '/rest/v1/rpc/get_my_ticket') return send(200,{registration_id:data.p_registration_id,event_id:event.id,title:event.title,event_date:event.event_date,location:event.location,ticket_name:'Free admission',token:ticketCode,checked_in_at:checkedAt})
  if(url.pathname === '/rest/v1/rpc/check_in_ticket') {
    if(data.p_event_id!==event.id||data.p_token!==ticketCode)return send(400,{message:'Ticket is invalid or belongs to another event'})
    const repeated=!!checkedAt;checkedAt??=new Date().toISOString();return send(200,{registration_id:'30000000-0000-0000-0000-000000000001',full_name:'Local Demo',ticket_name:'Free admission',checked_in_at:checkedAt,already_checked_in:repeated})
  }
  if(url.pathname === '/rest/v1/rpc/event_attendance_report') return send(200,{confirmed:1,checked_in:checkedAt?1:0,attendees:[{registration_id:'30000000-0000-0000-0000-000000000001',full_name:'Local Demo',status:'confirmed',checked_in_at:checkedAt}]})
  if(url.pathname === '/rest/v1/rpc/my_permissions') return send(200,{user_id:user.id,staff_role:'admin',can_manage_events:true,can_manage_roles:true,paid_member:!!adminMemberships.find(m=>m.user_id===user.id&&m.active)})
  if(url.pathname === '/rest/v1/rpc/my_volunteer_work') return send(200,{application,assignments:shifts.map(v=>({...v,title:event.title}))})
  if(url.pathname === '/rest/v1/rpc/submit_volunteer_application') {application={motivation:data.p_motivation,status:'submitted'};return send(200,null)}
  if(url.pathname === '/rest/v1/rpc/list_volunteer_applications') return send(200,application?[{...application,user_id:user.id,full_name:'Local Demo'}]:[])
  if(url.pathname === '/rest/v1/rpc/review_volunteer_application') {application.status=data.p_status;return send(200,null)}
  if(url.pathname === '/rest/v1/rpc/staff_event_report') return send(200,{event,registrations:registrations.map(r=>({...r,full_name:'Local Demo',ticket_name:'Free admission',registered_at:r.created_at})),volunteers:shifts,volunteer_candidates:[helper]})
  if(url.pathname === '/rest/v1/rpc/set_volunteer_assignment') {
   if(!data.p_duty || !Number.isFinite(Date.parse(data.p_start)) || !Number.isFinite(Date.parse(data.p_end)))return send(400,{message:'Check duty, shift times and reviewed hours'})
   const v={...helper,event_id:data.p_event_id,user_id:data.p_user_id,duty:data.p_duty,shift_start:data.p_start,shift_end:data.p_end,active:data.p_active,reviewed_hours:data.p_hours};shifts=[v];return send(200,null)
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
  if (url.pathname === '/rest/v1/memberships') return send(200,adminMemberships.find(m=>m.user_id===user.id)||null)
  if (url.pathname === '/rest/v1/membership_plans') return send(200,adminPlans.filter(p=>p.published||adminMemberships.some(m=>m.user_id===user.id&&m.plan_id===p.id)))
  if (['/rest/v1/membership_plans','/rest/v1/donation_campaigns','/rest/v1/payment_records'].includes(url.pathname)) return send(200, [])
  if (url.pathname === '/rest/v1/notification_preferences') {
    if (req.method === 'POST' || req.method === 'PATCH') preferences = { ...preferences, ...data, user_id: user.id }
    return send(200, preferences)
  }
  if (url.pathname === '/rest/v1/rpc/reserve_free_event') {
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
