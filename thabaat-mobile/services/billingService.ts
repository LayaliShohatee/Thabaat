import { supabase } from '@/lib/supabase'
import { BillingData, Campaign, Membership, Payment, Plan, validateCheckoutUrl } from '@/lib/billing'
import * as WebBrowser from 'expo-web-browser'

// Older staging builds can read campaign metadata without certifying legacy totals.
export async function getCampaignData() {
 const result=await supabase.rpc('campaign_listing')
 if(!result.error)return {...result,data:(result.data||[]).map((campaign:Campaign)=>({...campaign,verified_totals_available:true}))}
 if(!['PGRST202','42883'].includes(result.error.code))return result
 const fallback=await supabase.from('donation_campaigns').select('id,name,description,checkout_url,recurring_available,goal_cents').eq('published',true).order('name')
 return {...fallback,data:fallback.data?.map(campaign=>({...campaign,raised_cents:0,verified_totals_available:false}))||null}
}
export async function getBilling(): Promise<BillingData> {
 const { data: { user }, error: authError } = await supabase.auth.getUser()
 if (authError || !user) throw new Error('Please sign in again to view your membership and payments.')
 const results = await Promise.all([
  supabase.from('membership_plans').select('*').order('amount_cents'),
  supabase.from('memberships').select('*').eq('user_id', user.id).maybeSingle(),
  getCampaignData(),
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
