import { supabase } from '@/lib/supabase'
import { Event, EventWithTickets } from '@/types'

export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true })

  if (error) throw error
  return (data ?? []).filter(event => !event.archived)
}

export async function getEventById(eventId: string): Promise<EventWithTickets | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      ticket_types (*)
    `)
    .eq('id', eventId)
    .maybeSingle()

  if (error) throw error
  return data
}
