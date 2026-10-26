// Age, gender and guest details shared by sign-up, the profile step and event registration.
// The database enforces the same rules (migration 20261026120000_group_registration).
export type Gender = 'female' | 'male' | 'prefer_not_to_say'
export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

// Matches the client's web registration; "Other" covers anything not listed.
export const HEARD_FROM_OPTIONS = ['Friend Referral', 'Instagram', 'Email newsletter', 'Masjid announcement', 'Thabaat website', 'Other']

export const MAX_TICKETS_PER_BOOKING = 10

export function parseAge(text: string, min = 1): number | null {
  const value = text.trim()
  if (!/^\d{1,3}$/.test(value)) return null
  const age = Number(value)
  return age >= min && age <= 120 ? age : null
}

export const birthYearFromAge = (age: number, now = new Date()) => now.getFullYear() - age

export type Guest = { first_name: string; last_name: string; email: string; age: string; gender: Gender | '' }
export const emptyGuest = (): Guest => ({ first_name: '', last_name: '', email: '', age: '', gender: '' })

// Returns the first problem with a guest's details, or null when they are complete.
export function guestProblem(guest: Guest): string | null {
  if (!guest.first_name.trim() || !guest.last_name.trim()) return 'Enter a first and last name.'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guest.email.trim())) return 'Enter a valid email.'
  if (parseAge(guest.age) === null) return 'Enter an age from 1 to 120.'
  if (!guest.gender) return 'Choose a gender.'
  return null
}
