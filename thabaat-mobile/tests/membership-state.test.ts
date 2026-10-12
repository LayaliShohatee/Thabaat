import { expect, it } from 'vitest'
import { demoPeriodEnd, initialMembershipDemo, membershipSummary, reduceMembershipDemo as step } from '../lib/membership-state'
const now = Date.parse('2026-01-31T12:00:00Z')
const initial = () => initialMembershipDemo(now)
const paid = () => step(step(initial(), {type:'checkout',period:'monthly'}), {type:'confirm'})
it('opening practice checkout never activates membership', () => {
 const s = step(initial(), {type:'checkout',period:'monthly'})
 expect(s.pending).toBe(true); expect(membershipSummary(s.membership,s.now).active).toBe(false)
 expect(step(initial(),{type:'confirm'})).toEqual(initial())
})
it('verified practice checkout activates once, repeated confirmation cannot extend it', () => {
 const s = paid(); expect(membershipSummary(s.membership,s.now).active).toBe(true)
 expect(step(s,{type:'confirm'})).toEqual(s)
})
it('cancellation keeps current access until the exact expiry', () => {
 const s = step(paid(),{type:'cancel_renewal'})
 expect(membershipSummary(s.membership,s.now).active).toBe(true)
 expect(s.membership?.cancel_at_period_end).toBe(true)
 const expired = step(s,{type:'expire'})
 expect(membershipSummary(expired.membership,expired.now)).toMatchObject({active:false,label:'Expired'})
})
it('renewing active membership extends from paid-through date and clears cancellation', () => {
 const s = step(paid(),{type:'cancel_renewal'})
 const renewed = step(step(s,{type:'checkout',period:'monthly'}),{type:'confirm'})
 expect(renewed.membership?.expires_at).toBe('2026-03-28T12:00:00.000Z')
 expect(renewed.membership?.cancel_at_period_end).toBe(false)
})
it('failed renewal does not alter the active plan or billing period', () => {
 const s = paid()
 const failed = step(step(s,{type:'checkout',period:'one_time'}),{type:'fail'})
 expect(failed.membership).toEqual(s.membership); expect(failed.period).toBe('monthly')
})
it('expired membership renews from current time', () => {
 const s = step(paid(),{type:'expire'}); s.now += 86400000
 const renewed = step(step(s,{type:'checkout',period:'monthly'}),{type:'confirm'})
 expect(Date.parse(renewed.membership!.starts_at)).toBe(s.now)
})
it('one-time preview does not allow recurring cancellation', () => {
 const s = step(step(initial(),{type:'checkout',period:'one_time'}),{type:'confirm'})
 expect(step(s,{type:'cancel_renewal'})).toEqual(s)
})
it('complimentary preview expires and is not a recurring subscription', () => {
 const s = step(initial(),{type:'complimentary'})
 expect(membershipSummary(s.membership,s.now).label).toBe('Complimentary')
 expect(step(s,{type:'cancel_renewal'})).toEqual(s)
 const expired = step(s,{type:'expire'}); expect(membershipSummary(expired.membership,expired.now).active).toBe(false)
})
it('shows an in-app reminder near expiry without extending access', () => {
 const s=step(paid(),{type:'near_expiry'})
 expect(membershipSummary(s.membership,s.now).reminder).toContain('3 days')
 expect(s.membership).toEqual(paid().membership)
})
it('clamps calendar periods at month and leap-year boundaries', () => {
 expect(new Date(demoPeriodEnd(now,'monthly')).toISOString()).toBe('2026-02-28T12:00:00.000Z')
 expect(new Date(demoPeriodEnd(Date.parse('2024-02-29T12:00:00Z'),'annually')).toISOString()).toBe('2025-02-28T12:00:00.000Z')
})
it('overdue or unverified real memberships never show active access', () => {
 const m=paid().membership!
 expect(membershipSummary({...m,status:'past_due'},now)).toMatchObject({label:'Payment overdue',active:false})
 expect(membershipSummary({...m,verified_at:''},now)).toMatchObject({label:'Needs review',active:false})
})
it('overdue subscription practice pauses access and recovery does not extend dates', () => {
 const active = paid()
 const overdue = step(active,{type:'past_due'})
 expect(membershipSummary(overdue.membership,overdue.now)).toMatchObject({active:false,label:'Payment overdue'})
 const recovered = step(overdue,{type:'restore_payment'})
 expect(recovered.membership).toEqual(active.membership)
 expect(step(recovered,{type:'restore_payment'})).toEqual(recovered)
})
it('overdue recovery cannot revive expired access or alter one-time and complimentary plans', () => {
 const overdue = step(paid(),{type:'past_due'})
 const expired = step(overdue,{type:'expire'})
 expect(step(expired,{type:'restore_payment'})).toEqual(expired)
 const once = step(step(initial(),{type:'checkout',period:'one_time'}),{type:'confirm'})
 expect(step(once,{type:'past_due'})).toEqual(once)
 const comp = step(initial(),{type:'complimentary'})
 expect(step(comp,{type:'past_due'})).toEqual(comp)
})

it('future verification timestamps never activate real membership', () => {
 const m=paid().membership!
 expect(membershipSummary({...m,verified_at:new Date(now+86400000).toISOString()},now).active).toBe(false)
})
