import { supabase } from '@/lib/supabase'
import { Registration } from '@/types'

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
  return data ?? []
}

export async function createRegistration(
  userId: string,
  eventId: string,
  ticketTypeId: string
): Promise<Registration> {
  const { data, error } = await supabase
    .from('registrations')
    .insert({
      user_id: userId,
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      //status: 'confirmed' // need to fix this 
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function checkExistingRegistration(
  userId: string,
  eventId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('registrations')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .single()

  return !!data
}