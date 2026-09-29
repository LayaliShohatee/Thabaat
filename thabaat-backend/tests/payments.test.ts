import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHmac } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createApp } from '../src/app'
import { charityStackConfig, createCheckoutClient, verifyWebhook, type CharityStackConfig } from '../src/lib/charitystack'

const orderId = '00000000-0000-0000-0000-000000000001'
const formId = 'fixture-form', linkId = 'fixture-link'
const config: CharityStackConfig = { apiKey: 'cs_test_fixture', apiBaseUrl: 'https://api.example.invalid/v1', mode: 'test', webhookSecret: 'fixture-only-secret' }
const link = { linkID: linkId, formID: formId, checkoutUrl: `https://charitystack.com/attend/${formId}?elementid=${linkId}` }
function fakeDb() {
 const state = { owner: 'user1', status: 'pending', mode: 'test', saved: null as any, inbox: new Set<string>(), failInbox: false }
 const client = {
  auth: { getUser: async (token: string) => ({ data: { user: token === 'valid' ? { id: 'user1', email: 'account@example.invalid' } : null }, error: null }) },
  from(table: string) {
   let operation = 'select', body: any, filters: Record<string, unknown> = {}
   const run = async () => {
    if (table === 'paid_event_orders') return { data: filters.user_id === state.owner ? { id: orderId, form_id: formId, ticket_type_id: 'ticket', event_id: 'event', amount_cents: 100, currency: 'USD', status: state.status } : null }
    if (table === 'events') return { data: { event_date: new Date(Date.now() + 86400000).toISOString() } }
    if (table === 'paid_event_checkout_configs') return { data: { enabled: true, form_id: formId, provider_mode: state.mode, provider_ticket_name: 'Test ticket' } }
    if (table === 'charitystack_checkout_links') {
     if (operation === 'insert') { if (state.saved) return { error: { code: '23505' } }; state.saved = body }
     if (operation === 'update') state.saved = { ...state.saved, ...body }
     return { data: state.saved }
    }
    if (table === 'charitystack_webhook_inbox') {
     if (state.failInbox) return { error: { code: 'offline' } }
     if (state.inbox.has(body.payload_sha256)) return { error: { code: '23505' } }
     state.inbox.add(body.payload_sha256); return {}
    }
    throw new Error('Unexpected table ' + table)
   }
   const query = { select() { return query }, eq(k: string, v: unknown) { filters[k] = v; return query }, insert(value: unknown) { operation = 'insert'; body = value; return query }, update(value: unknown) { operation = 'update'; body = value; return query }, maybeSingle: run, then(resolve: any, reject: any) { return run().then(resolve, reject) } }
   return query
  },
 } as unknown as SupabaseClient
 return { state, client }
}
async function withServer(run: (request: (path: string, body: string, headers?: Record<string,string>) => Promise<{status:number;data:any}>, db: ReturnType<typeof fakeDb>, counts: {created:number}) => Promise<void>, failProvider = false) {
 const db = fakeDb(), counts = { created: 0 }
 const app = createApp(db.client, async () => [], { config, createCheckout: async input => { counts.created++; assert.equal(input.email, 'account@example.invalid'); assert.equal(input.amountCents, 100); if (failProvider) throw new Error('timeout'); return link } })
 const server = app.listen(0, '127.0.0.1')
 await new Promise<void>(resolve => server.once('listening', resolve))
 try {
  const port = (server.address() as {port:number}).port
  await run(async (path, body, headers = {}) => {
   const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })
   return { status: res.status, data: await res.json() }
  }, db, counts)
 } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
}
const auth = { Authorization: 'Bearer valid' }, body = JSON.stringify({ orderId })
test('checkout requires auth, ownership and server-controlled fields', async () => withServer(async (request, db, counts) => {
 assert.equal((await request('/payments/checkout', body)).status, 401)
 assert.equal((await request('/payments/checkout', JSON.stringify({orderId, amount: 1}), auth)).status, 400)
 db.state.owner = 'someone-else'
 assert.equal((await request('/payments/checkout', body, auth)).status, 404)
 assert.equal(counts.created, 0)
}))
test('checkout persists/reuses a link without confirming payment', async () => withServer(async (request, db, counts) => {
 assert.equal((await request('/payments/checkout', body, auth)).data.checkoutUrl, link.checkoutUrl)
 assert.equal((await request('/payments/checkout', body, auth)).status, 200)
 assert.equal(counts.created, 1); assert.equal(db.state.status, 'pending')
}))
test('completed orders and mixed test/live forms cannot create links', async () => withServer(async (request, db, counts) => {
 db.state.status = 'completed'; assert.equal((await request('/payments/checkout', body, auth)).status, 409)
 db.state.status = 'pending'; db.state.mode = 'live'; assert.equal((await request('/payments/checkout', body, auth)).status, 409)
 assert.equal(counts.created, 0)
}))
test('uncertain provider outcome blocks automatic retry', async () => withServer(async (request, db, counts) => {
 assert.equal((await request('/payments/checkout', body, auth)).status, 502)
 assert.equal(db.state.saved.status, 'needs_review')
 assert.equal((await request('/payments/checkout', body, auth)).status, 409)
 assert.equal(counts.created, 1)
}, true))
test('signed raw webhook is persisted before acknowledgment and replays are deduplicated', async () => withServer(async (request, db) => {
 const payload = '{ "type": "donation.created", "data": {"paymentID":"fixture"} }'
 const timestamp = String(Math.floor(Date.now()/1000))
 const signature = 'sha256=' + createHmac('sha256', config.webhookSecret).update(timestamp + '.' + payload).digest('hex')
 const headers = { 'X-Webhook-Timestamp': timestamp, 'X-Webhook-Signature': signature }
 assert.equal((await request('/payments/charitystack/webhook', payload + ' ', headers)).status, 401)
 assert.equal((await request('/payments/charitystack/webhook', payload, headers)).status, 202)
 assert.equal((await request('/payments/charitystack/webhook', payload, {...headers, 'X-Webhook-ID':'altered'})).data.duplicate, true)
 assert.equal(db.state.inbox.size, 1); assert.equal(db.state.status, 'pending')
 db.state.failInbox = true
 assert.equal((await request('/payments/charitystack/webhook', payload, headers)).status, 503)
}))
test('signature validator rejects malformed, expired and future timestamps without throwing', () => {
 for (const time of ['bad', '1700000000', '9999999999']) assert.equal(verifyWebhook(Buffer.from('{}'), time, 'sha256='+'0'.repeat(64), config.webhookSecret), false)
 assert.equal(verifyWebhook(Buffer.from('{}'), String(Math.floor(Date.now()/1000)), 'short', config.webhookSecret), false)
})
test('transport uses documented prefill, refuses redirects and validates returned destination', async () => {
 const input = { orderId, formId, email: 'account@example.invalid', ticketName: 'Test ticket', amountCents: 100 }
 const client = createCheckoutClient(config, (async (_url, init) => {
  assert.equal(init.redirect, 'error'); const payload = JSON.parse(init.body as string)
  assert.equal(payload.prefill.amount, 1); assert.equal(payload.prefill.customInputs['Thabaat app checkout reference'], orderId)
  assert.equal(payload.returnUrl, undefined)
  return new Response(JSON.stringify(link), {status:201})
 }) as typeof fetch)
 assert.deepEqual(await client(input), link)
 for (const checkoutUrl of ['https://evil.invalid/attend/fixture-form?elementid=fixture-link', link.checkoutUrl+'&redirect=https://evil.invalid']) {
  const bad = createCheckoutClient(config, (async () => new Response(JSON.stringify({...link, checkoutUrl}))) as typeof fetch)
  await assert.rejects(() => bad(input))
 }
})
test('configuration defaults off and rejects mismatched keys', () => {
 assert.equal(charityStackConfig({}), null)
 assert.throws(() => charityStackConfig({CHARITYSTACK_ENABLED:'true',CHARITYSTACK_MODE:'test',CHARITYSTACK_API_KEY:'cs_live_fixture'}))
 assert.throws(() => charityStackConfig({CHARITYSTACK_ENABLED:'true',CHARITYSTACK_MODE:'test',CHARITYSTACK_API_KEY:'cs_test_fixture'}))
})
