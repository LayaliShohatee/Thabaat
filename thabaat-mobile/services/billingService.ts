import { supabase } from '@/lib/supabase'
import { BillingData, Campaign, Membership, Payment, Plan, validateCheckoutUrl } from '@/lib/billing'
import * as WebBrowser from 'expo-web-browser'

export async function getBilling(): Promise<BillingData> {
 const { data: { user }, error: authError } = await supabase.auth.getUser()
 if (authError || !user) throw new Error('Please sign in again to view your membership and payments.')
 const results = await Promise.all([
  supabase.from('membership_plans').select('*').order('amount_cents'),
  supabase.from('memberships').select('*').eq('user_id', user.id).maybeSingle(),
  supabase.from('donation_campaigns').select('*').eq('published', true).order('name'),
  supabase.from('payment_records').select('id,purpose,description,amount_cents,currency,status,paid_at').eq('user_id', user.id).order('paid_at', { ascending: false }).limit(100),
 ])
 const failure = results.find(result => result.error)?.error
 if (failure) {
  if (['42P01','PGRST205'].includes(failure.code)) throw new Error('Membership and donation setup is being completed. Please try again later.')
  throw new Error('Unable to refresh membership and payment records. Please try again.')
 }
 return { plans: results[0].data as Plan[], membership: results[1].data as Membership | null, campaigns: results[2].data as Campaign[], payments: results[3].data as Payment[] }
}
export async function openHostedCheckout(url: string) {
 await WebBrowser.openBrowserAsync(validateCheckoutUrl(url), { dismissButtonStyle: 'done', toolbarColor: '#000000', controlsColor: '#FFFFFF' })
 // Closing or returning from checkout never verifies a payment.
}
