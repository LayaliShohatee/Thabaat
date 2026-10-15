// Event times are entered and shown in Thabaat's own timezone (Southeast Michigan), whatever the device's timezone is.
export const EVENT_TZ = 'America/Detroit'

export type WallTime = { date: string; time: string } // date 'YYYY-MM-DD', time 'HH:mm' (24-hour)

function partsAt(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') }
}

// Milliseconds the zone is ahead of UTC at a given instant (negative for Detroit).
function offsetAt(ms: number, tz: string) {
  const p = partsAt(ms, tz)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

// Converts a wall-clock time in the event timezone to an ISO instant, handling daylight saving changes.
export function wallTimeToIso({ date, time }: WallTime, tz = EVENT_TZ): string {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number)
  if (![y, mo, d, h, mi].every(Number.isFinite)) throw new Error('Choose a date and time.')
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  let ms = asUtc - offsetAt(asUtc, tz)
  ms = asUtc - offsetAt(ms, tz)
  return new Date(ms).toISOString()
}

export function isoToWallTime(iso: string, tz = EVENT_TZ): WallTime {
  const p = partsAt(Date.parse(iso), tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` }
}

export function formatEventTime(iso: string, tz = EVENT_TZ, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) {
  return new Date(iso).toLocaleString('en-US', { ...options, timeZone: tz })
}
