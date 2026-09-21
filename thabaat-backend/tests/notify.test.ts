import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createApp } from '../src/app'
import type { SendPush } from '../src/routes/notify'

const userId = '00000000-0000-0000-0000-000000000001'
const eventId = '00000000-0000-0000-0000-000000000002'
function fakeClient(overrides: Record<string, unknown> = {}) {
  const rows: Record<string, any> = { registrations: { id: 'registration' }, profiles: { expo_push_token: 'ExponentPushToken[fixture]' }, events: { title: 'Fixture event' }, ...overrides }
  return {
    auth: { getUser: async (token: string) => token === 'valid' ? { data: { user: { id: userId } }, error: null } : { data: { user: null }, error: { message: 'invalid' } } },
    from(table: string) {
      const query = {
        select() { return query },
        eq(field: string, value: string) {
          if (field === 'user_id' || (table === 'profiles' && field === 'id')) assert.equal(value, userId)
          if (field === 'event_id' || (table === 'events' && field === 'id')) assert.equal(value, eventId)
          return query
        },
        maybeSingle: async () => ({ data: rows[table] instanceof Error ? null : rows[table], error: rows[table] instanceof Error ? rows[table] : null }),
      }
      return query
    },
  } as unknown as SupabaseClient
}
async function request(client: SupabaseClient | null, body: unknown = { eventId }, token: string | null = 'valid', sender: SendPush = async () => [{ status: 'ok', id: 'ticket' }], path = '/notify') {
  const app = createApp(client, sender)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  try {
    const addr = server.address() as { port: number }
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, path === '/health' ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    })
    return { status: res.status, data: await res.json() }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
}
test('health works without server credentials and reports notifications unavailable', async () => {
  const result = await request(null, {}, null, undefined, '/health')
  assert.equal(result.status, 200); assert.equal(result.data.notificationsConfigured, false)
})
test('missing auth is rejected before any push', async () => assert.equal((await request(fakeClient(), { eventId }, null)).status, 401))
test('invalid auth is rejected', async () => assert.equal((await request(fakeClient(), { eventId }, 'invalid')).status, 401))
test('missing server credentials fail closed', async () => assert.equal((await request(null)).status, 503))
test('cannot request notifications for another user', async () => assert.equal((await request(fakeClient(), { eventId, userId: 'other' })).status, 403))
test('event ID is validated', async () => assert.equal((await request(fakeClient(), { eventId: 'bad' })).status, 400))
test('user must have a registration for the selected event', async () => assert.equal((await request(fakeClient({ registrations: null }))).status, 403))
test('database errors do not become a successful send', async () => assert.equal((await request(fakeClient({ registrations: new Error('unavailable') }))).status, 503))
test('missing token does not send', async () => assert.equal((await request(fakeClient({ profiles: {} }))).status, 409))
test('missing database column reports setup unavailable', async () => assert.equal((await request(fakeClient({ profiles: new Error('column missing') }))).status, 503))
test('Expo rejects a push ticket', async () => assert.equal((await request(fakeClient(), { eventId }, 'valid', async () => [{ status: 'error', message: 'DeviceNotRegistered' }])).status, 502))
test('Expo outage returns an actionable failure', async () => assert.equal((await request(fakeClient(), { eventId }, 'valid', async () => { throw new Error('offline') })).status, 502))
test('verified own registration sends once and reports acceptance only', async () => {
  let calls = 0
  const result = await request(fakeClient(), { eventId }, 'valid', async messages => {
    calls++; assert.equal(messages.length, 1); assert.equal(messages[0].data?.eventId, eventId)
    return [{ status: 'ok', id: 'ticket' }]
  })
  assert.equal(calls, 1); assert.equal(result.status, 200); assert.deepEqual(result.data, { success: true, status: 'accepted' })
})
