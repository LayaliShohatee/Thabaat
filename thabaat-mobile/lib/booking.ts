import type { TicketType } from '@/types'
import type { Guest } from '@/lib/attendee'
import type { TicketLine } from '@/services/registrationService'

export type Quantities = Record<string, number>

// One entry per seat, in the order the ticket types are listed.
export function ticketSlots(types: TicketType[], quantities: Quantities): TicketType[] {
  return types.flatMap(type => Array.from({ length: quantities[type.id] ?? 0 }, () => type))
}

export const ticketCount = (quantities: Quantities) => Object.values(quantities).reduce((sum, n) => sum + n, 0)

export const bookingTotal = (types: TicketType[], quantities: Quantities) =>
  types.reduce((sum, type) => sum + Number(type.price) * (quantities[type.id] ?? 0), 0)

// The seats left for guests once the account holder takes one of the chosen type.
export function guestSlots(slots: TicketType[], selfTypeId: string | null): TicketType[] {
  if (!selfTypeId) return slots
  const index = slots.findIndex(slot => slot.id === selfTypeId)
  return index < 0 ? slots : [...slots.slice(0, index), ...slots.slice(index + 1)]
}

export function bookingLines(selfTypeId: string | null, guestTypes: TicketType[], guests: Guest[]): TicketLine[] {
  const lines: TicketLine[] = selfTypeId ? [{ ticket_type_id: selfTypeId, self: true }] : []
  return lines.concat(guestTypes.map((type, i) => ({ ticket_type_id: type.id, self: false as const, ...guests[i] })))
}
