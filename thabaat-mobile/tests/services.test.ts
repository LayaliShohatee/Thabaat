import { beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => {
  const query: any = {}
  for (const method of ['select', 'eq', 'neq', 'gte', 'order', 'limit', 'insert']) query[method] = vi.fn(() => query)
  query.single = vi.fn()
  query.maybeSingle = vi.fn()
  const awaited: any[] = []
  query.then = (resolve: any) => Promise.resolve(awaited.shift() ?? { data: [], error: null }).then(resolve)
  return { query, awaited, from: vi.fn(() => query), getSession: vi.fn(), rpc: vi.fn() }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from: fake.from, rpc: fake.rpc, auth: { getSession: fake.getSession } } }))
import { getEvents, getEventById } from '../services/eventService'
import { checkExistingRegistration, createRegistration } from '../services/registrationService'

describe('database service contracts', () => {
  beforeEach(() => vi.clearAllMocks())
  it('filters and sorts by the live event_date column', async () => {
    await getEvents()
    expect(fake.query.gte).toHaveBeenCalledWith('event_date', expect.any(String))
    expect(fake.query.order).toHaveBeenCalledWith('event_date', { ascending: true })
  })
  it('returns null for a missing event', async () => {
    fake.query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await getEventById('missing')).toBeNull()
  })
  it('does not mistake a database error for no registration', async () => {
    fake.awaited.push({ data: null, error: new Error('offline') })
    await expect(checkExistingRegistration('user', 'event')).rejects.toThrow('offline')
  })
  it('ignores cancelled rows when checking for a registration', async () => {
    fake.awaited.push({ data: [], error: null })
    expect(await checkExistingRegistration('user','event')).toBe(false)
    expect(fake.query.neq).toHaveBeenCalledWith('status', 'cancelled')
  })
  it('finds an active registration even when the account holds several tickets', async () => {
    fake.awaited.push({ data: [{ id: 'a', status: 'confirmed' }], error: null })
    expect(await checkExistingRegistration('user', 'event')).toBe(true)
  })
  it('propagates reservation failures instead of showing confirmation', async () => {
    fake.rpc.mockResolvedValueOnce({ data: null, error: new Error('duplicate') })
    await expect(createRegistration('u', 'e', 't')).rejects.toThrow('duplicate')
  })
})
