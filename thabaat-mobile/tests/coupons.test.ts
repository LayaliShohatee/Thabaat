import { expect, it } from 'vitest'
import { couponTicketLabel } from '../lib/coupons'

it('labels which ticket a coupon applies to', () => {
 const tickets = [{ id: 't1', name: 'General admission' }, { id: 't2', name: 'Women’s tickets 21+' }]
 expect(couponTicketLabel({ event_id: 'e', ticket_type_id: 't2' }, tickets)).toBe('Women’s tickets 21+')
 expect(couponTicketLabel({ event_id: 'e', ticket_type_id: null }, tickets)).toBe('All tickets for this event')
 expect(couponTicketLabel({ event_id: null, ticket_type_id: null }, tickets)).toBe('All events · all tickets')
})
