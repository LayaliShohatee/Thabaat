import { describe, expect, it } from 'vitest'
import { bookingLines, bookingTotal, guestSlots, ticketCount, ticketSlots } from '../lib/booking'
import { emptyGuest, guestProblem, parseAge } from '../lib/attendee'
import type { TicketType } from '../types'

const men = { id: 'men', event_id: 'e', name: 'Men (Ages 23+)', price: 0 } as TicketType
const women = { id: 'women', event_id: 'e', name: 'Women (Ages 23+)', price: 5 } as TicketType

describe('booking helpers', () => {
  it('expands quantities into seats in listing order and totals them', () => {
    const quantities = { women: 2, men: 1 }
    expect(ticketSlots([men, women], quantities).map(t => t.id)).toEqual(['men', 'women', 'women'])
    expect(ticketCount(quantities)).toBe(3)
    expect(bookingTotal([men, women], quantities)).toBe(10)
  })
  it('gives the account holder one seat of their chosen type and the rest to guests', () => {
    const slots = ticketSlots([men, women], { men: 1, women: 2 })
    const guests = guestSlots(slots, 'women')
    expect(guests.map(t => t.id)).toEqual(['men', 'women'])
    const lines = bookingLines('women', guests, [{ ...emptyGuest(), first_name: 'A' }, { ...emptyGuest(), first_name: 'B' }])
    expect(lines.map(l => [l.ticket_type_id, l.self])).toEqual([['women', true], ['men', false], ['women', false]])
    expect(guestSlots(slots, null)).toHaveLength(3)
  })
  it('validates guest details and ages', () => {
    expect(parseAge('27')).toBe(27)
    expect(parseAge('12', 13)).toBeNull()
    expect(parseAge('abc')).toBeNull()
    expect(guestProblem(emptyGuest())).toMatch(/name/)
    expect(guestProblem({ first_name: 'A', last_name: 'B', email: 'a@b.co', age: '30', gender: '' })).toMatch(/gender/)
    expect(guestProblem({ first_name: 'A', last_name: 'B', email: 'a@b.co', age: '30', gender: 'female' })).toBeNull()
  })
})
