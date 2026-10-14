import type { PromoCode } from '@/services/refundDiscountService'
import type { InventoryTicket } from '@/services/ticketInventoryService'

// Says which ticket a coupon works on, e.g. "Women's tickets 21+".
export function couponTicketLabel(code: Pick<PromoCode, 'event_id' | 'ticket_type_id'>, tickets: Pick<InventoryTicket, 'id' | 'name'>[]) {
  if (!code.event_id) return 'All events · all tickets'
  if (!code.ticket_type_id) return 'All tickets for this event'
  return tickets.find(t => t.id === code.ticket_type_id)?.name || 'One ticket type'
}
