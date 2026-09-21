// Local-only UI smoke-test fixture. Never forwards requests to Supabase or Expo.
import http from 'node:http'
const host = '127.0.0.1'
const port = 54329
const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid', user_metadata: { full_name: 'Local Demo' }, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() }
const event = { id: '10000000-0000-0000-0000-000000000001', title: 'Local fixture community event', description: 'Synthetic event for local regression testing only.', event_date: new Date(Date.now() + 86400000 * 7).toISOString(), location: 'Local test venue', image_url: null, speaker_name: 'Demo speaker', capacity: 10, created_at: new Date().toISOString() }
const tickets = [{ id: '20000000-0000-0000-0000-000000000001', event_id: event.id, name: 'Free admission', price: 0, quantity: 10 }, { id: '20000000-0000-0000-0000-000000000002', event_id: event.id, name: 'Paid ticket unavailable', price: 10, quantity: 10 }]
const registrations = []
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
