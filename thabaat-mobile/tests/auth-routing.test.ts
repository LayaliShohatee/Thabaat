import { describe, expect, it } from 'vitest'
import { authRedirect, parseAuthLink } from '../lib/auth-routing'

describe('auth navigation', () => {
  it('protects private pages', () => expect(authRedirect(false, ['(tabs)', 'profile'])).toBe('/auth/login'))
  it('requires login for payment checks, even with a claimed success query', () => expect(authRedirect(false, ['payments', 'check'])).toBe('/auth/login'))
  it('protects change-password from signed-out visitors', () => expect(authRedirect(false, ['auth', 'change-password'])).toBe('/auth/login'))
  it('keeps signed-in password change accessible', () => expect(authRedirect(true, ['auth', 'change-password'])).toBeNull())
  it('allows recovery before and after session restoration', () => {
    expect(authRedirect(false, ['auth', 'reset-password'])).toBeNull()
    expect(authRedirect(true, ['auth', 'reset-password'])).toBeNull()
  })
  it('does not redirect while a callback is processed', () => expect(authRedirect(true, ['auth', 'callback'])).toBeNull())
  it('takes signed-in visitors out of login', () => expect(authRedirect(true, ['auth', 'login'])).toBe('/(tabs)'))
})
describe('email link parsing', () => {
  it('reads native recovery tokens from fragment', () => expect(parseAuthLink('thabaat://auth/reset-password#access_token=a&refresh_token=b&type=recovery')).toMatchObject({ accessToken: 'a', refreshToken: 'b', recovery: true }))
  it('reads PKCE code from a web callback', () => expect(parseAuthLink('https://app.example/auth/callback?code=test')).toMatchObject({ code: 'test', recovery: false }))
  it('surfaces expired link errors', () => expect(parseAuthLink('thabaat://auth/callback#error_description=Link%20expired').error).toBe('Link expired'))
})
