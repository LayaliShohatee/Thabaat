// The client's "Thabaat Volunteer Interest Form" (Google Forms), question for question.
// submit_volunteer_interest (migration 20261026120000) enforces the same required answers and the 23+ rule.
export const VOLUNTEER_INTRO = 'As-salamu alaikum! JazakAllah khairan for your interest in joining the Thabaat volunteer community. We’re looking for volunteers who are interested in helping shape the vision and direction of Thabaat. Fill out this form and our team will reach out insha’Allah!'

export const HOURS_OPTIONS = ['3-5 Hours', '4-6 Hours', '7-9 Hours', '10+ Hours']
export const ATTENDANCE_OPTIONS = ['No sessions yet', '1-3 sessions/events', '4-7 sessions/events', '8+ sessions/events']
export const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const CONTRIBUTE_OPTIONS = ['General Volunteer (minimum 1 event attended per month)', 'Program Anchor', 'Program Lead or Deputy (minimum 2 months as an active volunteer)', 'Media or Communications']
export const PROGRAM_OPTIONS = [
  'Thabaat Mondays (biweekly, every other Monday)',
  'Thabaat Popups (typically first or second Thursday of the month)',
  'Thabaat Qiyams (typically the third or fourth Friday of the month)',
  'Thabaat Professional (typically Saturday afternoons, every 1-2 months)',
  'Thabaat Socials (typically on off-Mondays, done quarterly [every 3 months])',
  'Not Applicable',
]
export const CONTACT_OPTIONS = ['Mobile', 'Email']

export type VolunteerInterest = {
  email: string; name: string; age: string; gender: 'male' | 'female' | ''; phone: string; city_state: string; profession: string
  experience: string; why_join: string; hours_per_month: string[]; attendance_frequency: string; attendance_other: string
  available_days: string[]; contribute_as: string[]; anchor_programs: string[]; media_skills: string; contact_method: string; referred_by: string
}

export const emptyVolunteerInterest = (prefill: Partial<VolunteerInterest> = {}): VolunteerInterest => ({
  email: '', name: '', age: '', gender: '', phone: '', city_state: '', profession: '', experience: '', why_join: '',
  hours_per_month: [], attendance_frequency: '', attendance_other: '', available_days: [], contribute_as: [], anchor_programs: [],
  media_skills: '', contact_method: '', referred_by: '', ...prefill,
})

export const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(v => v !== value) : [...list, value]

// First unanswered required question, or null when the form can be sent.
export function volunteerProblem(form: VolunteerInterest): string | null {
  const text: [keyof VolunteerInterest, string][] = [['email', 'Email'], ['name', 'Name'], ['phone', 'Phone number'], ['city_state', 'Where you’re located'],
    ['profession', 'What you do professionally'], ['experience', 'Past experiences'], ['why_join', 'Why you want to join']]
  for (const [key, label] of text) if (!String(form[key]).trim()) return `${label} is required.`
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return 'Enter a valid email.'
  const age = Number(form.age)
  if (!/^\d{1,3}$/.test(form.age.trim()) || age < 23 || age > 120) return 'Volunteers must be 23 or older.'
  if (!form.gender) return 'Choose a gender.'
  if (!form.hours_per_month.length) return 'Choose how many hours you can commit each month.'
  if (!form.attendance_frequency || (form.attendance_frequency === 'Other' && !form.attendance_other.trim())) return 'Tell us how often you’ve attended Thabaat.'
  if (!form.available_days.length) return 'Choose the days you’re available.'
  if (!form.contribute_as.length) return 'Choose how you’d like to contribute.'
  if (!form.anchor_programs.length) return 'Choose a program, or Not Applicable.'
  return null
}

// The answers object the database expects; "Other:" attendance carries the typed text.
export function volunteerAnswers(form: VolunteerInterest) {
  const { attendance_other, ...rest } = form
  return { ...rest, attendance_frequency: form.attendance_frequency === 'Other' ? `Other: ${attendance_other.trim()}` : form.attendance_frequency }
}

// Short labels for the answers when staff review an application.
export const VOLUNTEER_LABELS: Record<string, string> = {
  email: 'Email', name: 'Name', age: 'Age', gender: 'Gender', phone: 'Phone', city_state: 'Location', profession: 'Profession',
  experience: 'Past experience', why_join: 'Why join', hours_per_month: 'Hours per month', attendance_frequency: 'Attended Thabaat',
  available_days: 'Available days', contribute_as: 'Contribute as', anchor_programs: 'Anchor/Lead programs', media_skills: 'Media skills',
  contact_method: 'Best contact', referred_by: 'Referred by',
}
