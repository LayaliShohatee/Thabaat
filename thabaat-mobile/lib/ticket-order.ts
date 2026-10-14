import type { Registration } from '@/types'

// Upcoming items first (soonest at the top), then past ones (most recent first).
export function upcomingFirst<T>(rows: T[], time: (row: T) => number, now: number): T[] {
  const upcoming = rows.filter(r => time(r) >= now).sort((a, b) => time(a) - time(b))
  const past = rows.filter(r => time(r) < now).sort((a, b) => time(b) - time(a))
  return [...upcoming, ...past]
}

export function sortTickets(rows: Registration[], now: number): Registration[] {
  return upcomingFirst(rows, r => r.event?.event_date ? new Date(r.event.event_date).getTime() : 0, now)
}
