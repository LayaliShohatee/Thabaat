import { expect, it } from 'vitest'
import { filterRoster } from '../lib/checkin-roster'

const person = (id: string, full_name: string, checked_in_at: string | null = null) => ({ kind: 'registration' as const, id, full_name, ticket_name: 'General admission', checked_in_at })
const people = [person('1', 'Aisha Rahman', '2026-10-15T23:40:00Z'), person('2', 'Ahmad Saleh'), person('3', 'Zeynep Çelik'), person('4', 'Omar Rahman')]

it('finds people by any part of their name, ignoring case and accents', () => {
 expect(filterRoster(people, 'rah').map(p => p.id)).toEqual(['4', '1'])
 expect(filterRoster(people, 'celik').map(p => p.id)).toEqual(['3'])
 expect(filterRoster(people, 'omar rah').map(p => p.id)).toEqual(['4'])
})

it('lists people still to check in first', () => {
 expect(filterRoster(people, '').map(p => p.id)).toEqual(['2', '3', '4', '1'])
})
