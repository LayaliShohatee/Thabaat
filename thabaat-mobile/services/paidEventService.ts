import { supabase } from '@/lib/supabase'
import { openHostedCheckout } from '@/services/billingService'
import { validatePrefilledCheckoutUrl } from '@/lib/billing'
import * as WebBrowser from 'expo-web-browser'
const serverCheckoutEnabled = process.env.EXPO_PUBLIC_SERVER_CHECKOUT === 'true'
export type PaidEventOrder = { id: string; event_id: string; ticket_type_id: string; form_id: string; amount_cents: number; currency: string; status: 'pending' | 'completed' | 'refunded' | 'cancelled' }
export async function getPaidEventOrder(eventId: string): Promise<PaidEventOrder | null> {
 const { data: { user }, error: authError } = await supabase.auth.getUser()
 if (authError || !user) throw new Error('Please sign in again.')
 const { data,error } = await supabase.from('paid_event_orders').select('id,event_id,ticket_type_id,form_id,amount_cents,currency,status').eq('event_id',eventId).eq('user_id',user.id).maybeSingle()
 if (error) throw new Error('Unable to check your payment. Do not pay again; refresh or contact the team.')
 return data
}
export async function beginPaidEventOrder(ticketTypeId: string): Promise<PaidEventOrder> {
 const { data,error } = await supabase.rpc('begin_paid_event_checkout',{ p_ticket_type_id: ticketTypeId })
 if (error) throw new Error(error.message)
 if (!data?.id) throw new Error('Unable to prepare checkout.')
 return data
}
export async function openPaidEventCheckout(order: PaidEventOrder) {
 if (order.status !== 'pending') throw new Error('This checkout is no longer pending.')
 if (serverCheckoutEnabled) {
  const backend = process.env.EXPO_PUBLIC_BACKEND_URL
  const { data, error } = await supabase.auth.getSession()
  if (!backend || error || !data.session) throw new Error('Server checkout is unavailable. Check setup and sign in again.')
  const response = await fetch(`${backend.replace(/\/$/, '')}/payments/checkout`, {
   method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
   body: JSON.stringify({ orderId: order.id }), signal: AbortSignal.timeout(20000),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Checkout could not be prepared. Do not pay again.')
  await WebBrowser.openBrowserAsync(validatePrefilledCheckoutUrl(result.checkoutUrl, order.form_id), { dismissButtonStyle: 'done' })
  return
 }
 // The configured provider form determines the price. Browser return never grants access.
 await openHostedCheckout(`https://charitystack.com/attend/${order.form_id}`)
}
export async function getEventAccess(eventId: string): Promise<string | null> {
 const { data,error } = await supabase.from('event_access_details').select('access_text').eq('event_id',eventId).maybeSingle()
 if (error) throw new Error('Unable to load event access. Try again.')
 return data?.access_text ?? null
}
