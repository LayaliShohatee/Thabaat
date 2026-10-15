import { supabase } from '@/lib/supabase'
import type { CheckInResult } from '@/services/ticketService'

// Check in by name, walk-ins and event volunteer sign-ups (migration 20261014130000_volunteer_checkin).
export type RosterPerson = { kind: 'registration' | 'walk_in'; id: string; full_name: string; ticket_name: string; checked_in_at: string | null }
export type CheckinRoster = { can_check_in: boolean; check_in_opens_at?: string; capacity: number; confirmed: number; checked_in: number; walk_ins: number; people: RosterPerson[] }
export type VolunteerSignupStatus = 'requested' | 'confirmed' | 'cancelled'
export type VolunteerAnswers = { availability: string; preferred_role: string; notes: string }
export type MyVolunteerSignup = VolunteerAnswers & { event_id: string; title: string; event_date: string; location: string; status: VolunteerSignupStatus }
export type EventVolunteerSignup = VolunteerAnswers & { user_id: string; full_name: string; status: VolunteerSignupStatus; signed_up_at: string }
export type VolunteerRole = { duty: string; role_description: string; is_lead: boolean }

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
 const { data, error } = await supabase.rpc(name, args)
 if (error) throw new Error(error.code === 'PGRST202' ? 'Check-in and volunteer sign-up need a database update that isn’t installed here yet.' : error.message)
 return data as T
}

export const getCheckinRoster = (eventId: string, search = '') => rpc<CheckinRoster>('event_checkin_roster', { p_event_id: eventId, p_search: search })
export const checkInRegistration = (eventId: string, registrationId: string) => rpc<CheckInResult>('check_in_registration', { p_event_id: eventId, p_registration_id: registrationId })
export const addWalkIn = (eventId: string, fullName: string, contact: string) => rpc<{ id: string; full_name: string; checked_in_at: string }>('add_walk_in', { p_event_id: eventId, p_full_name: fullName, p_contact: contact })
export const removeWalkIn = (walkInId: string) => rpc<null>('remove_walk_in', { p_walk_in_id: walkInId })

export const signUpToVolunteer = (eventId: string, answers: VolunteerAnswers) => rpc<VolunteerSignupStatus>('sign_up_to_volunteer', { p_event_id: eventId, p_availability: answers.availability, p_preferred_role: answers.preferred_role, p_notes: answers.notes })
export const getMyVolunteerSignups = () => rpc<MyVolunteerSignup[]>('my_volunteer_signups')
export const cancelMyVolunteerSignup = (eventId: string) => rpc<null>('cancel_volunteer_signup', { p_event_id: eventId, p_user_id: null })

export const listVolunteerSignups = (eventId: string) => rpc<EventVolunteerSignup[]>('list_volunteer_signups', { p_event_id: eventId })
export const confirmVolunteerSignup = (eventId: string, userId: string, role: VolunteerRole) => rpc<null>('confirm_volunteer_signup', { p_event_id: eventId, p_user_id: userId, p_duty: role.duty, p_role_description: role.role_description, p_is_lead: role.is_lead })
export const makeRegistrantVolunteer = (eventId: string, registrationId: string, role: VolunteerRole) => rpc<null>('make_registrant_volunteer', { p_event_id: eventId, p_registration_id: registrationId, p_duty: role.duty, p_role_description: role.role_description, p_is_lead: role.is_lead })
export const setVolunteerRole = (eventId: string, userId: string, role: VolunteerRole) => rpc<null>('set_volunteer_role', { p_event_id: eventId, p_user_id: userId, p_duty: role.duty, p_role_description: role.role_description, p_is_lead: role.is_lead })
export const cancelVolunteer = (eventId: string, userId: string) => rpc<null>('cancel_volunteer_signup', { p_event_id: eventId, p_user_id: userId })
