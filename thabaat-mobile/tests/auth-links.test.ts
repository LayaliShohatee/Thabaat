import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  setSession: vi.fn(), exchangeCodeForSession: vi.fn(), getSession: vi.fn(),
}))
vi.mock('expo-linking', () => ({ createURL: (path: string) => `thabaat://${path}` }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))
let consumeAuthLink: typeof import('../lib/auth-links').consumeAuthLink
beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  auth.setSession.mockResolvedValue({ error: null })
  auth.exchangeCodeForSession.mockResolvedValue({ error: null })
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null })
  ;({ consumeAuthLink } = await import('../lib/auth-links'))
})
const recovery = 'thabaat://auth/reset-password#access_token=test-access&refresh_token=test-refresh&type=recovery'

describe('email link session restoration', () => {
  it('restores the recovery session before allowing password updates', async () => {
    expect(await consumeAuthLink(recovery)).toBe(true)
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' })
    expect(auth.getSession).toHaveBeenCalledOnce()
  })
  it('exchanges a PKCE recovery code', async () => {
    expect(await consumeAuthLink('thabaat://auth/reset-password?code=test-code')).toBe(true)
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code')
  })
  it('coalesces duplicate handling of a one-time link', async () => {
    const first = consumeAuthLink(recovery)
    expect(consumeAuthLink(recovery)).toBe(first)
    await first
    expect(auth.setSession).toHaveBeenCalledOnce()
  })
  it('permits retry after a transient verification failure', async () => {
    auth.setSession.mockRejectedValueOnce(new Error('Network unavailable'))
    await expect(consumeAuthLink(recovery)).rejects.toThrow('Network unavailable')
    expect(await consumeAuthLink(recovery)).toBe(true)
    expect(auth.setSession).toHaveBeenCalledTimes(2)
  })
  it('surfaces an expired email link without using an existing login', async () => {
    await expect(consumeAuthLink('thabaat://auth/reset-password#error_description=Link%20expired')).rejects.toThrow('Link expired')
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(auth.getSession).not.toHaveBeenCalled()
  })
  it('rejects a missing session instead of enabling the form', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await expect(consumeAuthLink('thabaat://auth/reset-password')).rejects.toThrow('missing or expired')
  })
  it('does not discard a newer link when an older exchange fails', async () => {
    let rejectFirst!: (error: Error) => void
    auth.setSession.mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject }))
    const first = consumeAuthLink(recovery)
    const failure = expect(first).rejects.toThrow('Offline')
    const newer = recovery.replace('test-access', 'new-access')
    const second = consumeAuthLink(newer)
    rejectFirst(new Error('Offline'))
    await failure
    await second
    expect(consumeAuthLink(newer)).toBe(second)
    expect(auth.setSession).toHaveBeenCalledTimes(2)
  })
})
