import { describe, expect, it } from 'vitest'
import { calendarDetails, calendarIcs, calendarProviderUrl, calendarResultMessage } from '../lib/event-calendar'
const event = { id: 'evt-1', title: 'Gather & Learn', description: 'Bring friends, family;\nWelcome!', event_date: '2026-11-01T01:30:00-04:00', location: 'Detroit, MI' }
describe('calendar export', () => {
  it('uses absolute times across daylight-saving transitions and labels provisional duration', () => {
    const d = calendarDetails(event)
    expect(d.startDate.toISOString()).toBe('2026-11-01T05:30:00.000Z')
    expect(d.endDate.toISOString()).toBe('2026-11-01T06:30:00.000Z')
    expect(d.notes).toContain('provisional')
  })
  it('preserves organizer-provided end time', () => {
    const d = calendarDetails({ ...event, end_date: '2026-11-01T08:30:00Z' })
    expect(d.endDate.toISOString()).toBe('2026-11-01T08:30:00.000Z')
    expect(d.notes).not.toContain('provisional')
  })
  it('uses rich event end and full address', () => {
    const d = calendarDetails({ ...event, end_at: '2026-11-01T08:30:00Z', address: '123 Venue Street' })
    expect(d.endDate.toISOString()).toBe('2026-11-01T08:30:00.000Z')
    expect(d.location).toBe('123 Venue Street')
  })
  it('rejects invalid start and backwards or invalid end times', () => {
    expect(() => calendarDetails({ ...event, event_date: 'bad' })).toThrow('start time')
    expect(() => calendarDetails({ ...event, end_date: 'bad' })).toThrow('end time')
    expect(() => calendarDetails({ ...event, end_date: '2020-01-01' })).toThrow('end time')
  })
  it('encodes provider drafts without leaking user or ticket information', () => {
    const google = new URL(calendarProviderUrl(event, 'google'))
    expect(google.hostname).toBe('calendar.google.com')
    expect(google.searchParams.get('text')).toBe(event.title)
    expect(google.searchParams.get('dates')).toBe('20261101T053000Z/20261101T063000Z')
    const outlook = new URL(calendarProviderUrl(event, 'outlook'))
    expect(outlook.searchParams.get('subject')).toBe(event.title)
    expect(outlook.searchParams.get('startdt')).toBe('2026-11-01T05:30:00.000Z')
  })
  it('escapes ICS text and provides stable UID for repeated imports', () => {
    const ics = calendarIcs(event, new Date('2026-10-05T00:00:00Z'))
    expect(ics).toContain('UID:evt-1@thabaat\r\n')
    expect(ics).toContain('LOCATION:Detroit\\, MI\r\n')
    expect(ics.replace(/\r\n /g, '')).toContain('Bring friends\\, family\\;\\nWelcome!')
    expect(ics).toContain('DTSTAMP:20261005T000000Z')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('folds UTF-8 lines without splitting characters or exceeding 75 octets', () => {
    const ics = calendarIcs({ ...event, title: '🌙'.repeat(70) })
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, '')).toContain('SUMMARY:' + '🌙'.repeat(70))
  })
  it('does not claim cancellation or Android editor opening saved an event', () => {
    expect(calendarResultMessage('canceled')).toContain('No event was added')
    expect(calendarResultMessage('done')).toContain('Confirm Save')
    expect(calendarResultMessage('saved')).toBe('Event saved to your calendar.')
  })
})
