import { calendarIcs, type CalendarEvent } from '@/lib/event-calendar'

export async function openDeviceCalendar(event: CalendarEvent) {
  const blob = new Blob([calendarIcs(event)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'thabaat-event.ics'
  document.body.appendChild(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000) }
  return 'Calendar file downloaded. Open it in Apple Calendar or another calendar app and confirm import.'
}
