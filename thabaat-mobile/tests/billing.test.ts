import { describe, expect, it } from 'vitest'
import { membershipIsActive, validateCheckoutUrl, type Membership } from '../lib/billing'
const current: Membership = { id: 'm', plan_id: 'p', status: 'active', starts_at: '2026-09-01T00:00:00Z', expires_at: '2026-10-01T00:00:00Z', cancel_at_period_end: false, source: 'charitystack', verified_at: '2026-09-01T00:00:00Z' }
const now = Date.parse('2026-09-28T00:00:00Z')
describe('membership period', () => {
 it('retains access when renewal is cancelled until the paid period ends', () => expect(membershipIsActive({ ...current, cancel_at_period_end: true }, now)).toBe(true))
 it.each(['expired','past_due','cancelled'] as const)('does not give access for %s', status => expect(membershipIsActive({ ...current, status }, now)).toBe(false))
 it('expires at the exact end of the period', () => expect(membershipIsActive(current, Date.parse(current.expires_at))).toBe(false))
 it('does not start access early', () => expect(membershipIsActive(current, Date.parse(current.starts_at) - 1)).toBe(false))
 it('rejects absent or invalid verification', () => expect(membershipIsActive({ ...current, verified_at: '' }, now)).toBe(false))
})
describe('hosted checkout destinations', () => {
 it('allows an actual CharityStack hosted form', () => expect(validateCheckoutUrl('https://charitystack.com/attend/5451350b-cef4-4e59-8240-aa457d4f7c7e')).toContain('/attend/'))
 it.each(['http://charitystack.com/donate/a','https://charitystack.com.evil.test/donate/a','https://evil.test/donate/a','https://user@charitystack.com/donate/a','https://charitystack.com/dashboard','https://charitystack.com/donate/a?redirect=https://evil.test','javascript:alert(1)'])('rejects %s', url => expect(() => validateCheckoutUrl(url)).toThrow())
})
