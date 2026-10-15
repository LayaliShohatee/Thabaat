import { supabase } from '@/lib/supabase'
import { Registration } from '@/types'
import { getMyTicket } from '@/services/ticketService'
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

// The caller's active booking for an event, so the event page can open the ticket directly.
export async function getMyEventRegistration(userId: string, eventId: string): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id,status')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
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
    .maybeSingle()

  if (error) throw error
  return !!data && data.status !== 'cancelled'
}

export async function cancelFreeRegistration(registrationId: string): Promise<Registration> {
  const { data, error } = await supabase.rpc('cancel_free_registration', { p_registration_id: registrationId })
  if (error) throw error
  return data
}
