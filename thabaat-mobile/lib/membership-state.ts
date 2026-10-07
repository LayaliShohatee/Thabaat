import { membershipIsActive, type Membership } from './billing'

export function membershipSummary(membership: Membership | null, now = Date.now()) {
 if (!membership) return { label: 'Free', active: false, reminder: 'Choose a paid plan when purchases become available.' }
 const active = membershipIsActive(membership, now)
 const end = Date.parse(membership.expires_at)
 if (!Number.isFinite(end) || !Number.isFinite(Date.parse(membership.verified_at))) return { label: 'Needs review', active: false, reminder: 'Contact the team to verify this membership.' }
 if (membership.status === 'past_due') return { label: 'Payment overdue', active: false, reminder: 'Check your billing details with CharityStack. Member access is paused.' }
 if (end <= now || membership.status === 'expired') return { label: 'Expired', active: false, reminder: 'Renew to restore member access. Do not pay again if a payment is awaiting verification.' }
 if (!active) return { label: membership.status === 'cancelled' ? 'Cancelled' : 'Not started', active: false, reminder: 'Member access is not currently active.' }
 if (membership.cancel_at_period_end) return { label: 'Active · ending soon', active: true, reminder: 'Renewal is cancelled. Access lasts through the recorded end date.' }
 const days = Math.ceil((end - now) / 86400000)
 return { label: membership.source === 'complimentary' ? 'Complimentary' : 'Active', active: true, reminder: days <= 7 ? `Your current membership period ends in ${days} day${days === 1 ? '' : 's'}. Check your renewal settings.` : 'Your membership is active through the recorded end date.' }
}

export type DemoPeriod = 'one_time' | 'monthly' | 'annually'
export type MembershipDemo = { now: number; membership: Membership | null; period: DemoPeriod; pendingPeriod: DemoPeriod; pending: boolean }
export type DemoAction = { type: 'checkout'; period: DemoPeriod } | { type: 'confirm' | 'fail' | 'cancel_renewal' | 'restore_renewal' | 'expire' | 'near_expiry' | 'complimentary' | 'past_due' | 'restore_payment' }
export const initialMembershipDemo = (now = Date.now()): MembershipDemo => ({ now, membership: null, period: 'monthly', pendingPeriod: 'monthly', pending: false })
// Preview-only durations. Commercial durations must come from approved plans/provider records.
export function demoPeriodEnd(start: number, period: DemoPeriod) {
 const date = new Date(start)
 if (period === 'one_time') return start + 30 * 86400000
 const day = date.getUTCDate()
 date.setUTCDate(1)
 date.setUTCMonth(date.getUTCMonth() + (period === 'annually' ? 12 : 1))
 const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
 date.setUTCDate(Math.min(day, last))
 return date.getTime()
}
// In-memory rehearsal only. This reducer never writes a membership, payment or subscription.
export function reduceMembershipDemo(state: MembershipDemo, action: DemoAction): MembershipDemo {
 const m = state.membership
 switch (action.type) {
  case 'checkout': return { ...state, pendingPeriod: action.period, pending: true }
  case 'fail': return { ...state, pending: false }
  case 'confirm': {
   if (!state.pending) return state
   const start = m && membershipIsActive(m, state.now) ? Date.parse(m.expires_at) : state.now
   return { ...state, pending: false, period: state.pendingPeriod, membership: { id: 'demo-only', plan_id: 'demo-paid', status: 'active', starts_at: m && membershipIsActive(m, state.now) ? m.starts_at : new Date(state.now).toISOString(), expires_at: new Date(demoPeriodEnd(start, state.pendingPeriod)).toISOString(), cancel_at_period_end: false, source: 'charitystack', verified_at: new Date(state.now).toISOString() } }
  }
  case 'past_due': return m && membershipIsActive(m, state.now) && m.source === 'charitystack' && state.period !== 'one_time' ? { ...state, pending: false, membership: { ...m, status: 'past_due' } } : state
  case 'restore_payment': return m?.status === 'past_due' && Date.parse(m.expires_at) > state.now ? { ...state, membership: { ...m, status: 'active' } } : state
  case 'cancel_renewal': return m && membershipIsActive(m, state.now) && m.source === 'charitystack' && state.period !== 'one_time' ? { ...state, membership: { ...m, cancel_at_period_end: true } } : state
  case 'restore_renewal': return m && membershipIsActive(m, state.now) ? { ...state, membership: { ...m, cancel_at_period_end: false } } : state
  case 'expire': return m ? { ...state, pending: false, now: Date.parse(m.expires_at) } : state
  case 'near_expiry': return m ? { ...state, now: Math.max(state.now, Date.parse(m.expires_at) - 3 * 86400000) } : state
  case 'complimentary': return { ...state, pending: false, membership: { id: 'demo-comp', plan_id: 'demo-paid', status: 'active', starts_at: new Date(state.now).toISOString(), expires_at: new Date(state.now + 30 * 86400000).toISOString(), cancel_at_period_end: false, source: 'complimentary', verified_at: new Date(state.now).toISOString() } }
 }
}
