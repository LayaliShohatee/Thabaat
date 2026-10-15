import { expect, it } from 'vitest'
import { formatEventTime, isoToWallTime, wallTimeToIso } from '../lib/event-time'

it('converts Detroit wall time to the right instant in daylight and standard time', () => {
 expect(wallTimeToIso({ date: '2026-10-15', time: '19:30' })).toBe('2026-10-15T23:30:00.000Z') // EDT, UTC-4
 expect(wallTimeToIso({ date: '2026-12-05', time: '19:30' })).toBe('2026-12-06T00:30:00.000Z') // EST, UTC-5
})

it('handles the night clocks fall back (Nov 1 2026)', () => {
 expect(wallTimeToIso({ date: '2026-10-31', time: '22:00' })).toBe('2026-11-01T02:00:00.000Z')
 expect(wallTimeToIso({ date: '2026-11-01', time: '03:00' })).toBe('2026-11-01T08:00:00.000Z')
})

it('round-trips and formats in Detroit time regardless of device timezone', () => {
 const iso = wallTimeToIso({ date: '2026-10-30', time: '21:00' })
 expect(isoToWallTime(iso)).toEqual({ date: '2026-10-30', time: '21:00' })
 expect(formatEventTime(iso)).toBe('Fri, Oct 30, 9:00 PM')
})

it('rejects a missing date or time', () => {
 expect(() => wallTimeToIso({ date: '', time: '19:00' })).toThrow('Choose a date and time.')
})
