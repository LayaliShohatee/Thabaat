import { supabase } from '@/lib/supabase'
import { isPaymentCheckEnabled, type PaymentAttempt } from '@/lib/payment-check'

const columns = 'id,status,provider_payment_id,verified_at,expected_amount_cents'
function assertEnabled() { if (!isPaymentCheckEnabled) throw new Error('Payment check is not enabled in this build.') }
export async function getPaymentAttempt(): Promise<PaymentAttempt | null> {
 assertEnabled()
 const { data: { user }, error: authError } = await supabase.auth.getUser()
 if (authError || !user) throw new Error('Please sign in again.')
 const { data, error } = await supabase.from('checkout_attempts').select(columns).eq('user_id', user.id).eq('form_id', '5451350b-cef4-4e59-8240-aa457d4f7c7e').maybeSingle()
 if (error) throw new Error('Unable to check payment status. Check your receipt before paying again.')
 return data
}
export async function beginPaymentAttempt(): Promise<PaymentAttempt> {
 assertEnabled()
 const { data, error } = await supabase.rpc('begin_internal_payment_check')
 if (error || !data?.id) throw new Error('Payment setup is incomplete. Checkout was not opened. Please ask the team to finish setup.')
 return data
}
