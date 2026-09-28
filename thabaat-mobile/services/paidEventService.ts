import { supabase } from '@/lib/supabase'
import { openHostedCheckout } from '@/services/billingService'
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
 // The configured provider form determines the price. Browser return never grants access.
 await openHostedCheckout(`https://charitystack.com/attend/${order.form_id}`)
}
export async function getEventAccess(eventId: string): Promise<string | null> {
 const { data,error } = await supabase.from('event_access_details').select('access_text').eq('event_id',eventId).maybeSingle()
 if (error) throw new Error('Unable to load event access. Try again.')
 return data?.access_text ?? null
}
