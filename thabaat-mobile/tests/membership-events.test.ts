import { expect, it } from 'vitest'
import { registerPracticeEvent as register } from '../lib/membership-events'
import { initialMembershipDemo, reduceMembershipDemo as step } from '../lib/membership-state'
const now=Date.parse('2026-09-29T12:00:00Z')
const paid=()=>step(step(initialMembershipDemo(now),{type:'checkout',period:'monthly'}),{type:'confirm'}).membership!
it('permits public registration without membership',()=>expect(register('community',null,[],now).accepted).toBe(true))
it.each(['study','workshop'])('blocks %s without membership',id=>{const r=register(id,null,[],now);expect(r.accepted).toBe(false);expect(r.registrations).toHaveLength(0)})
it('pending checkout does not satisfy membership',()=>{const s=step(initialMembershipDemo(now),{type:'checkout',period:'monthly'});expect(register('study',s.membership,[],now).accepted).toBe(false)})
it('allows active verified membership and prevents duplicates',()=>{const a=register('study',paid(),[],now);expect(a.accepted).toBe(true);expect(register('study',paid(),a.registrations,now).registrations).toHaveLength(1)})
it('allows cancelled renewal until exact expiry',()=>{const m={...paid(),cancel_at_period_end:true};expect(register('study',m,[],now).accepted).toBe(true);expect(register('study',m,[],Date.parse(m.expires_at)).accepted).toBe(false)})
it.each(['past_due','cancelled','expired'] as const)('blocks %s membership',status=>expect(register('study',{...paid(),status},[],now).accepted).toBe(false))
it('rejects missing verification and unknown event IDs',()=>{expect(register('study',{...paid(),verified_at:''},[],now).accepted).toBe(false);expect(register('unknown',paid(),[],now).accepted).toBe(false)})
