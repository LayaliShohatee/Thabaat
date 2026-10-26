import { supabase } from '@/lib/supabase'
import { Registration } from '@/types'
import { getMyTicket } from '@/services/ticketService'
import type { Gender, Guest } from '@/lib/attendee'
import { isDemoMode, isDemoEvent, demoScannerEventId, presentDemoEvent } from '@/lib/demo-mode'

export async function getUserRegistrations(userId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select(`
      *,
      event:events (*),
      ticket_type:ticket_types (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const registrations = await Promise.all((data ?? []).map(async (row): Promise<Registration> => {
    if (row.status !== 'confirmed') return row
    try { const ticket = await getMyTicket(row.id); return { ...row, checked_in_at: ticket.checked_in_at } }
    catch { return row } // Attendance remains unknown when a ticket read is unavailable.
  }))
  return isDemoMode ? registrations.filter(row=>row.event && isDemoEvent(row.event) && row.event_id!==demoScannerEventId).map(row=>({...row,event:row.event ? presentDemoEvent(row.event) : row.event})) : registrations
}

export async function createRegistration(
  userId: string,
  eventId: string,
  ticketTypeId: string
): Promise<Registration> {
  const { data, error } = await supabase.rpc('reserve_free_event', {
    p_event_id: eventId, p_ticket_type_id: ticketTypeId,
  })

  if (error) throw error
  return data
}

// The caller's active tickets for an event (one account can hold several), so the event page can open them directly.
export async function getMyEventRegistration(userId: string, eventId: string): Promise<{ id: string; status: string; count: number } | null> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id,status')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data?.length ? { ...data[0], count: data.length } : null
}

export type TicketLine = { ticket_type_id: string; self: true } | ({ ticket_type_id: string; self: false } & Guest)
export type BookingAnswers = { heard_from: string; first_event: boolean; social_time?: boolean }

// Free tickets for the caller and their guests in one booking (migration 20261026120000_group_registration).
export async function reserveFreeTickets(eventId: string, tickets: TicketLine[], answers: BookingAnswers): Promise<{ order_id: string; registration_ids: string[] }> {
  const { data, error } = await supabase.rpc('reserve_free_tickets', { p_event_id: eventId, p_tickets: tickets, p_answers: answers })
  if (error) throw new Error(error.code === 'PGRST202' ? 'Booking several tickets needs a database update that isn’t installed here yet.' : error.message)
  return data
}

export async function completeMyProfile(age: number, gender: Gender): Promise<void> {
  const { error } = await supabase.rpc('complete_my_profile', { p_age: age, p_gender: gender })
  if (error) throw new Error(error.message)
}

export async function checkExistingRegistration(
  userId: string,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id,status')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .neq('status', 'cancelled')
    .limit(1)

  if (error) throw error
  return !!data?.length
}

export async function cancelFreeRegistration(registrationId: string): Promise<Registration> {
  const { data, error } = await supabase.rpc('cancel_free_registration', { p_registration_id: registrationId })
  if (error) throw error
  return data
}
