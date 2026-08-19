import { supabase } from '@/lib/supabase'
import { Event } from '@/types'

export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('date', new Date().toISOString())
    .order('date', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getEventById(eventId: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      ticket_types (*)
    `)
    .eq('id', eventId)
    .single()

  if (error) throw error
  return data
}