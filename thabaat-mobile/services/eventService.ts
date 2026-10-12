import { supabase } from '@/lib/supabase'
import { Event, EventWithTickets, TicketType } from '@/types'
import { isDemoMode, isDemoEvent, demoScannerEventId, presentDemoEvent } from '@/lib/demo-mode'

export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true })

  if (error) throw error
  const events=(data ?? []).filter(event => !event.archived)
  return isDemoMode ? events.filter(event => isDemoEvent(event) && event.id !== demoScannerEventId).map(presentDemoEvent) : events
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
  return data && isDemoMode ? {...presentDemoEvent(data),speaker_name:null,ticket_types:data.ticket_types?.filter((ticket:TicketType)=>ticket.price===0).map((ticket:TicketType)=>({...ticket,name:'Free admission'}))} : data
}
