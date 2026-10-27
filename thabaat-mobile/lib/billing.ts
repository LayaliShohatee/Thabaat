export type Plan = { id: string; name: string; description: string; benefits: string[]; amount_cents: number | null; currency: string; billing_period: 'one_time' | 'monthly' | 'annually'; checkout_url: string | null; published: boolean; acquisition_mode?: 'charitystack' | 'complimentary' }
export type Membership = { id: string; plan_id: string; status: 'active' | 'past_due' | 'expired' | 'cancelled'; starts_at: string; expires_at: string; cancel_at_period_end: boolean; source: 'charitystack' | 'complimentary'; verified_at: string }
export type Campaign = { verified_totals_available?: boolean; featured?: boolean; id: string; name: string; description: string; checkout_url: string; recurring_available: boolean; goal_cents: number | null; raised_cents: number }
export type Payment = { id: string; purpose: 'membership' | 'donation' | 'event'; description: string; amount_cents: number; currency: string; status: string; paid_at: string }
export type BillingData = { plans: Plan[]; membership: Membership | null; campaigns: Campaign[]; payments: Payment[] }
export const emptyBilling: BillingData = { plans: [], membership: null, campaigns: [], payments: [] }
export function membershipIsActive(m: Membership | null, now = Date.now()): boolean {
 return !!m && m.status === 'active' && Number.isFinite(Date.parse(m.verified_at)) && Date.parse(m.verified_at) <= now && Date.parse(m.starts_at) <= now && Date.parse(m.expires_at) > now
}
export function money(cents: number, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100) }
export function periodLabel(period: Plan['billing_period']) { return { one_time: 'one-time', monthly: 'per month', annually: 'per year' }[period] }
// Only public hosted forms. No arbitrary redirect, embedded credentials, or account tokens.
export function validateCheckoutUrl(value: string): string {
 const url = new URL(value)
 if (url.protocol !== 'https:' || !['charitystack.com', 'www.charitystack.com'].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !/^\/(donate|attend)\/[a-zA-Z0-9-]+\/?$/.test(url.pathname)) throw new Error('This checkout link is not configured correctly. Please contact Thabaat.')
 return url.toString()
}
// Server-created hosted links permit only the documented elementid parameter.
export function validatePrefilledCheckoutUrl(value: string, formId: string): string {
 const url = new URL(value)
 const linkId = url.searchParams.get('elementid')
 if (!linkId || !/^[a-zA-Z0-9-]+$/.test(linkId) || [...url.searchParams.keys()].length !== 1 || url.pathname !== `/attend/${formId}`) throw new Error('Invalid prefilled checkout link.')
 const base = new URL(url.toString()); base.search = ''
 validateCheckoutUrl(base.toString())
 return url.toString()
}

// A ticket price typed in dollars ("5", "5.50", "$12"); null unless it's $0–$10,000 with at most 2 decimal places.
export function parseTicketPrice(text: string): number | null {
  const value = text.trim().replace(/^\$/, '')
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(value)) return null
  const price = Number(value)
  return price <= 10000 ? price : null
}
