import type { Event } from '@/types'

export type CalendarEvent = Pick<Event, 'id' | 'title' | 'description' | 'event_date' | 'location'> & { end_date?: string | null; end_at?: string | null; address?: string | null }

export function calendarDetails(event: CalendarEvent) {
  const startDate = new Date(event.event_date)
  if (!Number.isFinite(startDate.getTime())) throw new Error('This event does not have a valid start time.')
  const end = event.end_at ?? event.end_date
  const suppliedEnd = end ? new Date(end) : null
  if (suppliedEnd && (!Number.isFinite(suppliedEnd.getTime()) || suppliedEnd <= startDate)) throw new Error('This event does not have a valid end time.')
  // Existing events store a start only. Make the provisional duration explicit to the member.
  const endDate = suppliedEnd ?? new Date(startDate.getTime() + 60 * 60 * 1000)
  const notes = [event.description, !suppliedEnd ? 'End time is provisional (one hour). Confirm the schedule with the organizer.' : null].filter(Boolean).join('\n\n')
  return { title: event.title, startDate, endDate, location: event.address || event.location, notes }
}

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
export function calendarProviderUrl(event: CalendarEvent, provider: 'google' | 'outlook') {
  const d = calendarDetails(event)
  const query = provider === 'google'
    ? new URLSearchParams({ action: 'TEMPLATE', text: d.title, dates: `${stamp(d.startDate)}/${stamp(d.endDate)}`, details: d.notes, location: d.location })
    : new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: d.title, startdt: d.startDate.toISOString(), enddt: d.endDate.toISOString(), body: d.notes, location: d.location })
  return `${provider === 'google' ? 'https://calendar.google.com/calendar/render' : 'https://outlook.live.com/calendar/0/deeplink/compose'}?${query}`
}

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
// RFC 5545 folds by octets, including the continuation space. Never split UTF-8 characters.
function fold(line: string) {
  const result: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const codePoint = char.codePointAt(0)!
    const size = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4
    if (bytes + size > 75) { result.push(current); current = ' '; bytes = 1 }
    current += char; bytes += size
  }
  result.push(current)
  return result.join('\r\n')
}
export function calendarIcs(event: CalendarEvent, now = new Date()) {
  const d = calendarDetails(event)
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Thabaat//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${escape(event.id)}@thabaat`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(d.startDate)}`, `DTEND:${stamp(d.endDate)}`,
    `SUMMARY:${escape(d.title)}`, `LOCATION:${escape(d.location)}`, `DESCRIPTION:${escape(d.notes)}`, 'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n'
}

export function calendarResultMessage(action: string) {
  if (action === 'saved') return 'Event saved to your calendar.'
  if (action === 'canceled') return 'Calendar editor closed. No event was added.'
  if (action === 'deleted') return 'Event removed from your calendar.'
  return 'Calendar editor opened. Confirm Save in your calendar app.'
}
