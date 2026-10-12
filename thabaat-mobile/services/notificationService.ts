import { supabase } from '@/lib/supabase'

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL
export async function sendRegistrationConfirmation(eventId: string): Promise<boolean> {
  if (!BACKEND_URL) return false
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) return false
    const response = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ eventId }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const result = await response.json()
    return result.success === true
  } catch {
    // An unavailable notification service must not undo a saved registration.
    return false
  }
}
