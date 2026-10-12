import { afterEach, expect, it, vi } from 'vitest'

const openBrowserAsync = vi.hoisted(() => vi.fn())
vi.mock('expo-web-browser', () => ({ openBrowserAsync }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
  vi.resetAllMocks()
})

it.each([undefined, '', 'false'])('does not open a live checkout without explicit opt-in (%s)', async flag => {
  vi.stubGlobal('__DEV__', true)
  vi.stubEnv('EXPO_PUBLIC_ENABLE_PAYMENT_CHECK', flag)
  const { openPaymentCheck } = await import('../services/paymentCheckService')
  await expect(openPaymentCheck()).rejects.toThrow('not enabled')
  expect(openBrowserAsync).not.toHaveBeenCalled()
})

it('blocks the internal live checkout in release builds even when opted in', async () => {
  vi.stubGlobal('__DEV__', false)
  vi.stubEnv('EXPO_PUBLIC_ENABLE_PAYMENT_CHECK', 'true')
  const { openPaymentCheck } = await import('../services/paymentCheckService')
  await expect(openPaymentCheck()).rejects.toThrow('not enabled')
  expect(openBrowserAsync).not.toHaveBeenCalled()
})

it.each(['opened', 'cancel', 'dismiss', 'success'])('does not interpret browser result %s as a verified payment', async type => {
  vi.stubGlobal('__DEV__', true)
  vi.stubEnv('EXPO_PUBLIC_ENABLE_PAYMENT_CHECK', 'true')
  openBrowserAsync.mockResolvedValue({ type, url: 'thabaat://payments/check?paid=true' })
  const { openPaymentCheck } = await import('../services/paymentCheckService')
  expect(await openPaymentCheck()).toBeUndefined()
  expect(openBrowserAsync).toHaveBeenCalledExactlyOnceWith(
    'https://charitystack.com/attend/5451350b-cef4-4e59-8240-aa457d4f7c7e',
    expect.objectContaining({ dismissButtonStyle: 'done' }),
  )
})

it('surfaces browser failures so the screen can offer a retry', async () => {
  vi.stubGlobal('__DEV__', true)
  vi.stubEnv('EXPO_PUBLIC_ENABLE_PAYMENT_CHECK', 'true')
  openBrowserAsync.mockRejectedValue(new Error('Browser unavailable'))
  const { openPaymentCheck } = await import('../services/paymentCheckService')
  await expect(openPaymentCheck()).rejects.toThrow('Browser unavailable')
})

// Only data read from the protected server record can drive the confirmation UI.
it('requires a completed provider-verified record for success', async () => {
  const { isVerifiedPayment } = await import('../lib/payment-check')
  const attempt = { id: 'fixture', status: 'completed' as const, provider_payment_id: 'fixture-payment', verified_at: '2026-09-28T12:00:00Z', expected_amount_cents: 100 }
  expect(isVerifiedPayment(attempt)).toBe(true)
  expect(isVerifiedPayment({ ...attempt, status: 'pending' })).toBe(false)
  expect(isVerifiedPayment({ ...attempt, status: 'refunded' })).toBe(false)
  expect(isVerifiedPayment({ ...attempt, provider_payment_id: null })).toBe(false)
  expect(isVerifiedPayment({ ...attempt, verified_at: null })).toBe(false)
  expect(isVerifiedPayment({ ...attempt, verified_at: 'invalid' })).toBe(false)
  expect(isVerifiedPayment(null)).toBe(false)
})
