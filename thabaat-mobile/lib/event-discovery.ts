import type { Event } from '@/types'

export type EventWindow = 'all' | 'week' | 'month'
export interface EventFilters { search: string; window: EventWindow; location: string }

export function filterEvents(events: Event[], filters: EventFilters, now = new Date()): Event[] {
  const query = filters.search.trim().toLowerCase()
  const end = new Date(now)
  if (filters.window === 'week') end.setDate(end.getDate() + 7)
  if (filters.window === 'month') end.setMonth(end.getMonth() + 1)
  return events.filter(event => {
    const date = new Date(event.event_date).getTime()
    return Number.isFinite(date) && date >= now.getTime()
      && (filters.window === 'all' || date < end.getTime())
      && (!filters.location || event.location === filters.location)
      && (!query || [event.title, event.location, event.description, event.speaker_name].filter(Boolean).join(' ').toLowerCase().includes(query))
  }).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
}
