export type Plan = { id: string; name: string; description: string; benefits: string[]; amount_cents: number | null; currency: string; billing_period: 'one_time' | 'monthly' | 'annually'; checkout_url: string | null; published: boolean }
export type Membership = { id: string; plan_id: string; status: 'active' | 'past_due' | 'expired' | 'cancelled'; starts_at: string; expires_at: string; cancel_at_period_end: boolean; source: 'charitystack' | 'complimentary'; verified_at: string }
export type Campaign = { id: string; name: string; description: string; checkout_url: string; recurring_available: boolean; goal_cents: number | null; raised_cents: number }
export type Payment = { id: string; purpose: 'membership' | 'donation' | 'event'; description: string; amount_cents: number; currency: string; status: string; paid_at: string }
export type BillingData = { plans: Plan[]; membership: Membership | null; campaigns: Campaign[]; payments: Payment[] }
export const emptyBilling: BillingData = { plans: [], membership: null, campaigns: [], payments: [] }
export function membershipIsActive(m: Membership | null, now = Date.now()): boolean {
 return !!m && m.status === 'active' && Number.isFinite(Date.parse(m.verified_at)) && Date.parse(m.starts_at) <= now && Date.parse(m.expires_at) > now
}
export function money(cents: number, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100) }
export function periodLabel(period: Plan['billing_period']) { return { one_time: 'one-time', monthly: 'per month', annually: 'per year' }[period] }
// Only public hosted forms. No arbitrary redirect, embedded credentials, or account tokens.
export function validateCheckoutUrl(value: string): string {
 const url = new URL(value)
 if (url.protocol !== 'https:' || !['charitystack.com', 'www.charitystack.com'].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !/^\/(donate|attend)\/[a-zA-Z0-9-]+\/?$/.test(url.pathname)) throw new Error('This checkout link is not configured correctly. Please contact Thabaat.')
 return url.toString()
}
