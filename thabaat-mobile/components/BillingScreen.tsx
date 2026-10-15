import { useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { emptyBilling, membershipIsActive, money, periodLabel } from '@/lib/billing'
import { getBilling, openHostedCheckout } from '@/services/billingService'
import { membershipSummary } from '@/lib/membership-state'
import MembershipChangeCard from '@/components/MembershipChangeCard'
import { cancelMonthlyDonation, getMonthlyDonations, getPaymentsMode, sandboxDonate, sandboxPurchaseMembership, startMonthlyDonation, type MonthlyGift, type PaymentsMode } from '@/services/sandboxPaymentService'
import { brand } from '@/constants/brand'

function BillingButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
 return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>
}

export function BillingScreen({ section }: { section: 'membership' | 'donations' | 'history' }) {
 const { data, loading, error, reload } = useFocusResource(getBilling, emptyBilling)
 const [notice, setNotice] = useState('')
 const [opening, setOpening] = useState(false)
 const locked = useRef(false)
 async function checkout(url: string) {
  if (locked.current) return
  locked.current = true; setOpening(true); setNotice('')
  try { await openHostedCheckout(url); setNotice('Checkout opened. Payment is not confirmed here. Check your CharityStack receipt before trying again, then refresh your records.'); await reload() }
  catch (err) { setNotice(err instanceof Error ? err.message : 'Could not open checkout. Please try again.') }
  finally { locked.current = false; setOpening(false) }
 }
 const { data: paymentsMode } = useFocusResource(getPaymentsMode, 'off' as PaymentsMode)
 const sandbox = paymentsMode === 'sandbox'
 const { data: monthly, reload: reloadMonthly } = useFocusResource(getMonthlyDonations, [] as MonthlyGift[])
 // Test-mode payments: recorded in Thabaat immediately; no money moves.
 async function testPay(action: () => Promise<unknown>, success: string) {
  if (locked.current) return
  locked.current = true; setOpening(true); setNotice('')
  try { await action(); setNotice(success); await reload() }
  catch (err) { setNotice(err instanceof Error ? err.message : 'Test payment failed. Please try again.') }
  finally { locked.current = false; setOpening(false) }
 }
 const membership = data.membership
 const active = membershipIsActive(membership)
 const summary = membershipSummary(membership)
 const currentPlan = data.plans.find(p => p.id === membership?.plan_id)
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.title}>{section === 'membership' ? 'Your membership' : section === 'donations' ? 'Support Thabaat' : 'Payment history'}</Text>
  <Text style={styles.copy}>{section === 'membership' ? 'Your plan, benefits, and membership dates in one place.' : section === 'donations' ? (sandbox ? 'Test mode: gifts are recorded instantly and no money is charged.' : 'Support programs and community resources through CharityStack.') : 'Verified payments linked to your Thabaat account. Receipts are sent by CharityStack.'}</Text>
  {section==='membership' && __DEV__ && <BillingButton label="Practice membership flows · no charges" onPress={() => router.push('/membership-preview')} />}
  {loading && <ActivityIndicator accessibilityLabel="Loading billing records" color={brand.tealText} />}
  {!!error && <View style={styles.card}><Text accessibilityRole="alert" style={styles.copy}>{error}</Text></View>}
  {!loading && !error && section === 'membership' && <>
   <View style={styles.feature}><Text style={styles.eyebrow}>CURRENT MEMBERSHIP</Text><Text style={styles.heading}>{active ? currentPlan?.name ?? 'Member' : 'Free'}</Text>
    <Text style={styles.copy}>{summary.label} · {summary.reminder}</Text>
    {membership ? <><Text style={styles.copy}>Recorded status: {membership.status.replace('_', ' ')}{membership.source === 'complimentary' ? ' · Complimentary' : ''}</Text><Text style={styles.copy}>{active ? membership.cancel_at_period_end ? 'Access ends' : 'Current period ends' : 'Recorded end date'}: {new Date(membership.expires_at).toLocaleDateString()}</Text>{active && membership.cancel_at_period_end && <Text style={styles.copy}>Renewal is cancelled. Access continues until the current period ends.</Text>}</> : <Text style={styles.copy}>No paid membership is linked to your account. You can browse public events and register for free events.</Text>}
    {active && currentPlan?.benefits.map(benefit => <Text key={benefit} style={styles.copy}>• {benefit}</Text>)}
   </View>
   <Text style={styles.heading}>Membership plans</Text>
   {data.plans.filter(p => p.published).length === 0 && <View style={styles.card}><Text style={styles.copy}>Paid plans are not available yet. Prices, benefits, and checkout will appear here when Thabaat publishes them.</Text></View>}
   {data.plans.filter(p => p.published).map(plan => <View key={plan.id} style={styles.card}><Text style={styles.heading}>{plan.name}</Text><Text style={styles.price}>{plan.acquisition_mode==='complimentary' ? 'Complimentary · issued by Thabaat' : plan.amount_cents === null ? 'Price not set' : `${money(plan.amount_cents, plan.currency)} ${periodLabel(plan.billing_period)}`}</Text><Text style={styles.copy}>{plan.description}</Text>{plan.benefits.map(benefit => <Text key={benefit} style={styles.copy}>• {benefit}</Text>)}<Text style={styles.copy}>{plan.acquisition_mode==='complimentary'?'Complimentary access requires an approved administrator issuance with a recorded end date.':sandbox?'Test mode: joining records your membership instantly. No money is charged.':'Purchases open when the payment provider is connected.'}</Text>{sandbox && plan.acquisition_mode!=='complimentary' && plan.amount_cents ? <BillingButton label={opening ? 'Processing…' : active && plan.id === membership?.plan_id ? `Renew for ${money(plan.amount_cents, plan.currency)} (test payment)` : `Join for ${money(plan.amount_cents, plan.currency)} (test payment)`} onPress={() => void testPay(() => sandboxPurchaseMembership(plan.id), `Welcome! Your ${plan.name} membership is active. Test payment — no money was charged.`)} disabled={opening} /> : <BillingButton label={active && plan.id === membership?.plan_id ? 'Current plan' : plan.acquisition_mode==='complimentary'?'Administrator issuance required':'Purchases unavailable'} onPress={() => {}} disabled />}</View>)}
   {membership?.source === 'charitystack' && <MembershipChangeCard membership={membership} plans={data.plans} styles={styles}/>}
  </>}
  {!loading && !error && section === 'donations' && <>
   {monthly.length > 0 && <View style={styles.card}><Text style={styles.heading}>Your monthly gifts</Text>{monthly.map(g => <View key={g.id}><Text style={styles.copy}>{money(g.amount_cents)} each month to {g.campaign} · next gift {new Date(g.next_charge_at).toLocaleDateString()}</Text><BillingButton label={`Stop monthly gift to ${g.campaign}`} onPress={() => void testPay(async () => { await cancelMonthlyDonation(g.id); await reloadMonthly() }, 'Monthly gift stopped. No further gifts will be recorded.')} disabled={opening} /></View>)}</View>}
   {data.campaigns.length === 0 && <View style={styles.card}><Text style={styles.copy}>No donation campaigns have been published in the app yet.</Text></View>}
   {data.campaigns.map(campaign => <View key={campaign.id} style={styles.card}><Text style={styles.heading}>{campaign.featured?'Featured · ':''}{campaign.name}</Text><Text style={styles.copy}>{campaign.description}</Text>{campaign.goal_cents !== null && campaign.verified_totals_available!==false && <><View accessibilityRole="progressbar" accessibilityLabel={`${campaign.name} verified donation progress`} accessibilityValue={{min:0,max:100,now:Math.min(100,Math.round(campaign.raised_cents/campaign.goal_cents*100))}} style={{height:10,backgroundColor: brand.line,borderRadius:5,overflow:'hidden',marginVertical:8}}><View style={{height:10,backgroundColor: brand.primary,width:`${Math.min(100,Math.max(0,campaign.raised_cents/campaign.goal_cents*100))}%`}}/></View><Text style={styles.price}>{money(campaign.raised_cents)} in verified donations of {money(campaign.goal_cents)} goal</Text></>}{campaign.goal_cents!==null&&campaign.verified_totals_available===false&&<Text style={styles.price}>{money(campaign.goal_cents)} goal · Verified progress unavailable</Text>}<Text style={styles.copy}>{campaign.recurring_available ? 'Choose a one-time or recurring donation at checkout. Manage recurring gifts through your CharityStack email.' : 'Review the amount and payment terms at checkout.'}</Text>{sandbox ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1000, 2500, 5000].map(cents => <BillingButton key={cents} label={opening ? '…' : `Give ${money(cents)} (test)`} onPress={() => void testPay(() => sandboxDonate(campaign.id, cents), `Thank you! ${money(cents)} test donation recorded for ${campaign.name}. No money was charged.`)} disabled={opening} />)}<BillingButton label={opening ? '…' : monthly.some(g => g.campaign_id === campaign.id) ? 'Giving monthly ✓' : 'Give $10 monthly (test)'} onPress={() => void testPay(async () => { await startMonthlyDonation(campaign.id, 1000); await reloadMonthly() }, `Thank you! Your $10 monthly gift to ${campaign.name} has started. Test payment — no money was charged.`)} disabled={opening || monthly.some(g => g.campaign_id === campaign.id)} /></View> : <BillingButton label={opening ? 'Opening…' : 'Donate with CharityStack'} onPress={() => void checkout(campaign.checkout_url)} disabled={opening} />}</View>)}
   <Text style={styles.copy}>Campaign progress reflects linked verified records; provider totals may differ until reconciliation. Payments open securely with CharityStack. Your card details are not stored in Thabaat. A donation does not activate a membership or reserve an event ticket.</Text>
  </>}
  {!loading && !error && section === 'history' && <>
   {data.payments.length === 0 && <View style={styles.card}><Text style={styles.copy}>No verified payments are linked to your account yet. This does not mean an external checkout failed. Check your CharityStack receipt before paying again.</Text></View>}
   {data.payments.map(payment => <View key={payment.id} style={styles.card}><Text style={styles.heading}>{payment.description}</Text><Text style={styles.price}>{money(payment.amount_cents, payment.currency)}</Text><Text style={styles.copy}>{payment.purpose} · {payment.status} · {new Date(payment.paid_at).toLocaleDateString()}</Text></View>)}
   <Text style={styles.copy}>Showing up to 100 latest linked payments. CharityStack history is not automatically imported yet. Keep the receipt emailed by CharityStack for every payment.</Text>
  </>}
  {!!notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
  <BillingButton label={loading ? 'Refreshing…' : 'Refresh records'} onPress={() => void reload()} disabled={loading} />
  {section !== 'history' && <BillingButton label="Payment history" onPress={() => router.push('/payments/history')} />}
  {section !== 'donations' && <BillingButton label="Support Thabaat" onPress={() => router.push('/donations')} />}
 </ScrollView>
}
const styles = StyleSheet.create({
 page: { flex: 1, backgroundColor: brand.page }, content: { padding: 24, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 700, alignSelf: 'center' },
 title: { fontSize: 30, fontWeight: '700', color: brand.ink }, heading: { fontSize: 20, fontWeight: '600', color: brand.ink },
 copy: { fontSize: 15, lineHeight: 23, color: brand.inkMuted }, card: { padding: 20, backgroundColor: '#FFF', borderRadius: 16, gap: 10, borderWidth: 1, borderColor: brand.line },
 feature: { padding: 22, backgroundColor: brand.oliveSoft, borderRadius: 16, gap: 10 }, eyebrow: { fontSize: 12, color: brand.olive, fontWeight: '700', letterSpacing: 1 },
 price: { color: brand.olive, fontSize: 18, fontWeight: '600' }, button: { padding: 16, backgroundColor: brand.primary, borderRadius: 10, alignItems: 'center' }, buttonText: { color: '#FFF', fontWeight: '600', fontSize: 15 }, disabled: { opacity: 0.55 }, notice: { fontSize: 15, lineHeight: 23, color: brand.zaytDeep, backgroundColor: brand.zaytSoft, padding: 16, borderRadius: 10 },
})
