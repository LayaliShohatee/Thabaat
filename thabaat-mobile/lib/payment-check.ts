// This is the separate, one-ticket live checkout created for internal testing.
// It is not a mapping for any of the app's event registrations.
export const paymentCheck = {
  title: 'Thabaat App — Internal Payment Check',
  priceLabel: '$1.00 USD',
  url: 'https://charitystack.com/attend/5451350b-cef4-4e59-8240-aa457d4f7c7e',
} as const

// Opt in locally; never expose the internal live-payment test in release builds.
export const isPaymentCheckEnabled = typeof __DEV__ !== 'undefined' && __DEV__ &&
  process.env.EXPO_PUBLIC_ENABLE_PAYMENT_CHECK === 'true'

export type PaymentAttempt = { id: string; status: 'pending' | 'completed' | 'failed' | 'refunded'; provider_payment_id: string | null; verified_at: string | null; expected_amount_cents: number }
export function isVerifiedPayment(attempt: PaymentAttempt | null) {
  return attempt?.status === 'completed' && !!attempt.provider_payment_id && !!attempt.verified_at && Number.isFinite(Date.parse(attempt.verified_at))
}
