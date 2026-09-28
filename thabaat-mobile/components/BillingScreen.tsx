import { useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { emptyBilling, membershipIsActive, money, periodLabel } from '@/lib/billing'
import { getBilling, openHostedCheckout } from '@/services/billingService'

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
 const membership = data.membership
 const active = membershipIsActive(membership)
 const currentPlan = data.plans.find(p => p.id === membership?.plan_id)
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.title}>{section === 'membership' ? 'Your membership' : section === 'donations' ? 'Support Thabaat' : 'Payment history'}</Text>
  <Text style={styles.copy}>{section === 'membership' ? 'Your plan, benefits, and membership dates in one place.' : section === 'donations' ? 'Support programs and community resources through CharityStack.' : 'Verified payments linked to your Thabaat account. Receipts are sent by CharityStack.'}</Text>
  {loading && <ActivityIndicator accessibilityLabel="Loading billing records" color="#159A8C" />}
  {!!error && <View style={styles.card}><Text accessibilityRole="alert" style={styles.copy}>{error}</Text></View>}
  {!loading && !error && section === 'membership' && <>
   <View style={styles.feature}><Text style={styles.eyebrow}>CURRENT MEMBERSHIP</Text><Text style={styles.heading}>{active ? currentPlan?.name ?? 'Member' : 'Free'}</Text>
    {membership ? <><Text style={styles.copy}>Recorded status: {membership.status.replace('_', ' ')}{membership.source === 'complimentary' ? ' · Complimentary' : ''}</Text><Text style={styles.copy}>{active ? membership.cancel_at_period_end ? 'Access ends' : 'Current period ends' : 'Recorded end date'}: {new Date(membership.expires_at).toLocaleDateString()}</Text>{membership.cancel_at_period_end && <Text style={styles.copy}>Renewal is cancelled. Access continues until the current period ends.</Text>}</> : <Text style={styles.copy}>No paid membership is linked to your account. You can browse public events and register for free events.</Text>}
    {active && currentPlan?.benefits.map(benefit => <Text key={benefit} style={styles.copy}>• {benefit}</Text>)}
   </View>
   <Text style={styles.heading}>Membership plans</Text>
   {data.plans.filter(p => p.published).length === 0 && <View style={styles.card}><Text style={styles.copy}>Paid plans are not available yet. Prices, benefits, and checkout will appear here when Thabaat publishes them.</Text></View>}
   {data.plans.filter(p => p.published).map(plan => <View key={plan.id} style={styles.card}><Text style={styles.heading}>{plan.name}</Text><Text style={styles.price}>{plan.amount_cents === null ? 'Price not set' : `${money(plan.amount_cents, plan.currency)} ${periodLabel(plan.billing_period)}`}</Text><Text style={styles.copy}>{plan.description}</Text>{plan.benefits.map(benefit => <Text key={benefit} style={styles.copy}>• {benefit}</Text>)}<Text style={styles.copy}>Purchases are not enabled until membership activation is connected.</Text><BillingButton label={active && plan.id === membership?.plan_id ? 'Current plan' : 'Purchases unavailable'} onPress={() => {}} disabled /></View>)}
   {membership?.source === 'charitystack' && <View style={styles.card}><Text style={styles.heading}>Renewals and cancellation</Text><Text style={styles.copy}>Use the subscription-management link in your CharityStack email to manage recurring payments. Renewals, upgrades, and cancellations are not yet available inside Thabaat. Closing this app does not cancel a subscription.</Text></View>}
  </>}
  {!loading && !error && section === 'donations' && <>
   {data.campaigns.length === 0 && <View style={styles.card}><Text style={styles.copy}>No donation campaigns have been published in the app yet.</Text></View>}
   {data.campaigns.map(campaign => <View key={campaign.id} style={styles.card}><Text style={styles.heading}>{campaign.name}</Text><Text style={styles.copy}>{campaign.description}</Text>{campaign.goal_cents !== null && <Text style={styles.price}>{money(campaign.raised_cents)} raised of {money(campaign.goal_cents)}</Text>}<Text style={styles.copy}>{campaign.recurring_available ? 'Choose a one-time or recurring donation at checkout. Manage recurring gifts through your CharityStack email.' : 'Review the amount and payment terms at checkout.'}</Text><BillingButton label={opening ? 'Opening…' : 'Donate with CharityStack'} onPress={() => void checkout(campaign.checkout_url)} disabled={opening} /></View>)}
   <Text style={styles.copy}>Payments open securely with CharityStack. Your card details are not stored in Thabaat. A donation does not activate a membership or reserve an event ticket.</Text>
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
 page: { flex: 1, backgroundColor: '#F5F8F7' }, content: { padding: 24, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 700, alignSelf: 'center' },
 title: { fontSize: 30, fontWeight: '700', color: '#172B28' }, heading: { fontSize: 20, fontWeight: '600', color: '#172B28' },
 copy: { fontSize: 15, lineHeight: 23, color: '#425550' }, card: { padding: 20, backgroundColor: '#FFF', borderRadius: 16, gap: 10, borderWidth: 1, borderColor: '#DFE8E4' },
 feature: { padding: 22, backgroundColor: '#E0F2EA', borderRadius: 16, gap: 10 }, eyebrow: { fontSize: 12, color: '#256E5C', fontWeight: '700', letterSpacing: 1 },
 price: { color: '#256E5C', fontSize: 18, fontWeight: '600' }, button: { padding: 16, backgroundColor: '#146B59', borderRadius: 10, alignItems: 'center' }, buttonText: { color: '#FFF', fontWeight: '600', fontSize: 15 }, disabled: { opacity: 0.55 }, notice: { fontSize: 15, lineHeight: 23, color: '#62470C', backgroundColor: '#FFF2CD', padding: 16, borderRadius: 10 },
})
