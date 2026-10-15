import type { RosterPerson } from '@/services/volunteerCheckinService'

// Name search for the door list: matches any part of any word, ignores case and accents.
// People still to check in come first so the volunteer's next tap is near the top.
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function filterRoster(people: RosterPerson[], search: string): RosterPerson[] {
 const terms = fold(search).split(/\s+/).filter(Boolean)
 const matches = people.filter(p => { const name = fold(p.full_name); return terms.every(t => name.includes(t)) })
 return [...matches.filter(p => !p.checked_in_at), ...matches.filter(p => p.checked_in_at)]
}
