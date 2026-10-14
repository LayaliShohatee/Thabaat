import { expect, it } from 'vitest'
import { blankEventForm, formFromEvent, missingRequired, toSaveInput, withEventType } from '../lib/event-form'

const now = Date.parse('2026-10-14T12:00:00Z')

it('events default to 23+ and qiyams to all ages', () => {
 expect(blankEventForm().age_min).toBe('23')
 expect(withEventType(blankEventForm(), 'qiyam').age_min).toBe('')
 expect(withEventType(withEventType(blankEventForm(), 'qiyam'), 'event').age_min).toBe('23')
})

it('names every missing required item', () => {
 expect(missingRequired({ ...blankEventForm(), capacity: '' })).toEqual(['a title', 'a date and time', 'a location', 'a capacity from 1 to 10000'])
 expect(() => toSaveInput(blankEventForm(), now)).toThrow('Add a title, a date and time, a location.')
})

it('saves Detroit wall time as the right instant with the Detroit timezone', () => {
 const form = { ...blankEventForm(), title: 'Pop-Up @ Kitab', location: 'Kitab Cafe, Detroit', start: { date: '2026-10-15', time: '19:30' }, end: { date: '2026-10-15', time: '21:00' } }
 const input = toSaveInput(form, now)
 expect(input.date).toBe('2026-10-15T23:30:00.000Z')
 expect(input.details.end_at).toBe('2026-10-16T01:00:00.000Z')
 expect(input.details.timezone).toBe('America/Detroit')
 expect(input.details.age_min).toBe('23')
})

it('rejects a past start for new events and an end before the start', () => {
 const form = { ...blankEventForm(), title: 'Open Hands', location: 'Miftaah Banquet Hall', start: { date: '2026-10-01', time: '19:00' } }
 expect(() => toSaveInput(form, now)).toThrow('Choose a start time in the future.')
 expect(() => toSaveInput({ ...form, start: { date: '2026-10-19', time: '19:00' }, end: { date: '2026-10-19', time: '18:00' } }, now)).toThrow('End time must be after start time.')
})

it('loads an existing event back into the form in Detroit time', () => {
 const form = formFromEvent({ id: 'e1', title: 'Deeply Devoted: A Monthly Qiyam', event_date: '2026-10-31T01:00:00Z', location: 'Masjid Al-Salam', capacity: 120, age_min: null })
 expect(form.start).toEqual({ date: '2026-10-30', time: '21:00' })
 expect(form.type).toBe('qiyam')
 expect(form.capacity).toBe('120')
})
