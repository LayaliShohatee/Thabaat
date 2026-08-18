export interface Profile {
  id: string
  email: string
  full_name: string
  expo_push_token: string | null
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  image_url: string | null
  speaker_name: string | null
  capacity: number
  created_at: string
}

export interface TicketType {
  id: string
  event_id: string
  name: string
  price: number
  description: string | null
}

export interface Registration {
  id: string
  user_id: string
  event_id: string
  ticket_type_id: string
  status: 'confirmed' | 'cancelled' | 'pending'
  created_at: string
  event?: Event
  ticket_type?: TicketType
}
