import { emptyEventDetails, validateEventDetails, type EventDetails } from '@/lib/event-details'
import { EVENT_TZ, isoToWallTime, wallTimeToIso, type WallTime } from '@/lib/event-time'
import { parseTicketPrice } from '@/lib/billing'

// Thabaat events are 23+; Qiyam nights are open to all ages. Admins can still change the age afterwards.
export const EVENT_TYPES = [
 { id: 'event', label: 'Event', ageMin: '23', note: 'Ages 23+' },
 { id: 'qiyam', label: 'Qiyam', ageMin: '', note: 'All ages' },
] as const
export type EventType = typeof EVENT_TYPES[number]['id']

export type EventForm = {
 id: string | null
 type: EventType
 title: string; start: WallTime | null; location: string; capacity: string; age_min: string
 description: string; end: WallTime | null; image_url: string; address: string; speaker_name: string; speaker_bio: string
 audience_gender: string; eligibility: string; logistics: string; faqs: string; members_only: boolean
 ask_social_time: boolean
 // The General admission ticket's price: free, or paid at `price` dollars.
 paid: boolean; price: string
}

// Optional fields, in the order shown. Every one of them appears on the public event page when filled in.
export const OPTIONAL_FIELDS: { key: 'description' | 'address' | 'speaker_name' | 'speaker_bio' | 'audience_gender' | 'eligibility' | 'logistics' | 'faqs'; label: string; hint?: string; multiline?: boolean }[] = [
 { key: 'description', label: 'Description', hint: 'What is this event about?', multiline: true },
 { key: 'address', label: 'Street address', hint: 'e.g. 11200 E 11 Mile Rd, Warren, MI' },
 { key: 'speaker_name', label: 'Speaker' },
 { key: 'speaker_bio', label: 'About the speaker', multiline: true },
 { key: 'audience_gender', label: 'Who it’s for', hint: 'e.g. Brothers and sisters' },
 { key: 'eligibility', label: 'Eligibility notes', multiline: true },
 { key: 'logistics', label: 'Parking, food and what to bring', multiline: true },
 { key: 'faqs', label: 'Event FAQs', multiline: true },
]

export function blankEventForm(type: EventType = 'event'): EventForm {
 return { id: null, type, title: '', start: null, location: '', capacity: '50', age_min: EVENT_TYPES.find(t => t.id === type)!.ageMin,
  description: '', end: null, image_url: '', address: '', speaker_name: '', speaker_bio: '', audience_gender: '', eligibility: '', logistics: '', faqs: '', members_only: false, ask_social_time: type === 'qiyam', paid: false, price: '' }
}

export function withEventType(form: EventForm, type: EventType): EventForm {
 return { ...form, type, age_min: EVENT_TYPES.find(t => t.id === type)!.ageMin }
}

type ExistingEvent = Partial<EventDetails> & { ask_social_time?: boolean; id: string; title: string; description?: string | null; event_date: string; location: string; capacity?: number | null }
export function formFromEvent(event: ExistingEvent): EventForm {
 const tz = event.timezone || EVENT_TZ
 const isQiyam = /qiyam/i.test(event.title) || !event.age_min
 return { ...blankEventForm(isQiyam ? 'qiyam' : 'event'), id: event.id, title: event.title, start: isoToWallTime(event.event_date, tz), location: event.location || '',
  capacity: String(event.capacity ?? 50), age_min: event.age_min || '', description: event.description || '', end: event.end_at ? isoToWallTime(event.end_at, tz) : null,
  image_url: event.image_url || '', address: event.address || '', speaker_name: event.speaker_name || '', speaker_bio: event.speaker_bio || '',
  audience_gender: event.audience_gender || '', eligibility: event.eligibility || '', logistics: event.logistics || '', faqs: event.faqs || '', members_only: !!event.members_only, ask_social_time: !!event.ask_social_time }
}

// Lists what's still missing from the required box, in plain words.
export function missingRequired(form: EventForm): string[] {
 const missing: string[] = []
 if (form.title.trim().length < 3) missing.push('a title')
 if (!form.start) missing.push('a date and time')
 if (!form.location.trim()) missing.push('a location')
 const capacity = Number(form.capacity)
 if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) missing.push('a capacity from 1 to 10000')
 if (form.paid && ticketPrice(form) === null) missing.push('a ticket price above $0')
 return missing
}

export function toSaveInput(form: EventForm, now = Date.now()) {
 const missing = missingRequired(form)
 if (missing.length) throw new Error(`Add ${missing.join(', ')}.`)
 const date = wallTimeToIso(form.start!)
 if (!form.id && Date.parse(date) <= now) throw new Error('Choose a start time in the future.')
 const end_at = form.end ? wallTimeToIso(form.end) : ''
 const details = validateEventDetails({ ...emptyEventDetails, image_url: form.image_url, age_min: form.age_min, age_max: '', address: form.address, speaker_name: form.speaker_name,
  speaker_bio: form.speaker_bio, audience_gender: form.audience_gender, eligibility: form.eligibility, logistics: form.logistics, faqs: form.faqs, timezone: EVENT_TZ, end_at, members_only: form.members_only }, date)
 return { id: form.id, title: form.title.trim(), description: form.description.trim(), date, location: form.location.trim(), capacity: Number(form.capacity), details }
}

// The General admission price to save: 0 when free, null when "Paid" has no valid price above $0 yet.
export function ticketPrice(form: Pick<EventForm, 'paid' | 'price'>): number | null {
 if (!form.paid) return 0
 const price = parseTicketPrice(form.price)
 return price && price > 0 ? price : null
}
