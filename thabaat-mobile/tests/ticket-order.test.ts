import { expect, it } from 'vitest'
import { sortTickets } from '../lib/ticket-order'
it('My tickets lists upcoming events soonest first, then past events newest first', () => {
 const row = (id: string, date: string) => ({ id, event: { event_date: date } }) as any
 const now = new Date('2026-10-14T12:00:00Z').getTime()
 const sorted = sortTickets([row('past-old', '2026-10-01'), row('later', '2026-10-30'), row('past-new', '2026-10-06'), row('soon', '2026-10-19')], now)
 expect(sorted.map(r => r.id)).toEqual(['soon', 'later', 'past-new', 'past-old'])
})
