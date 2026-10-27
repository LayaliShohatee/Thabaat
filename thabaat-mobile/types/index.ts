export interface Profile {
  id: string
  email: string
  full_name: string
  expo_push_token?: string | null
  gender?: 'female' | 'male' | 'prefer_not_to_say' | null
  birth_year?: number | null
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string | null
  event_date: string
  location: string
  image_url: string | null
  speaker_name?: string | null
  capacity?: number
  ask_social_time?: boolean
  created_at?: string
}

export interface TicketType {
  id: string
  event_id: string
  name: string
  price: number
  description?: string | null
  category?: string | null
  sale_ends_at?: string | null
}

export interface Registration {
  id: string
  user_id: string
  event_id: string
  ticket_type_id: string
  status?: 'confirmed' | 'cancelled' | 'pending'
  checked_in_at?: string | null
  order_id?: string | null
  is_self?: boolean
  attendee_first_name?: string | null
  attendee_last_name?: string | null
  created_at: string
  event?: Event
  ticket_type?: TicketType
}

export interface EventWithTickets extends Event {
  ticket_types: TicketType[]
}
