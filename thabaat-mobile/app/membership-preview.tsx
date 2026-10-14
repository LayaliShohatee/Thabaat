import { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { initialMembershipDemo, membershipSummary, reduceMembershipDemo, type DemoAction, type DemoPeriod } from '@/lib/membership-state'
import { practiceEvents, registerPracticeEvent, type PracticeRegistration } from '@/lib/membership-events'

export default function MembershipPreview() {
 const [state, setState] = useState(initialMembershipDemo)
 const [selected, setSelected] = useState<DemoPeriod>('monthly')
 const [cancelling, setCancelling] = useState(false)
 const [notice, setNotice] = useState('')
 const [registrations, setRegistrations] = useState<PracticeRegistration[]>([])
 const [eventNotice, setEventNotice] = useState('')
 if (!__DEV__) return <View style={styles.page}><Text>Membership practice is available in development builds only.</Text></View>
 const summary = membershipSummary(state.membership, state.now)
 const apply = (action: DemoAction) => { setState(current => reduceMembershipDemo(current, action)); setNotice('') }
 const button = (label: string, onPress: () => void) => <TouchableOpacity key={label} accessibilityRole="button" onPress={onPress} style={styles.button}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.badge}>PRACTICE ONLY · NO CHARGES</Text>
  <Text style={styles.title}>Try membership flows</Text>
  <Text style={styles.copy}>Changes on this screen stay in memory. They do not change your account, cancel a real subscription, or grant real member access. Leaving this screen resets the practice.</Text>
  <View style={styles.card}>
   <Text style={styles.heading}>{summary.active ? 'Paid tier (practice)' : 'Free tier (practice)'}</Text>
   <Text style={styles.copy}>{summary.label}</Text><Text style={styles.copy}>{summary.reminder}</Text>
   {state.membership && <Text style={styles.copy}>Period ends: {new Date(state.membership.expires_at).toLocaleDateString()}</Text>}
   <Text style={styles.copy}>Practice date: {new Date(state.now).toLocaleDateString()}</Text>
  </View>
  <Text style={styles.heading}>Practice event registration</Text>
  <Text style={styles.copy}>Try a members-only event while Free, then simulate verified membership below and try again. These are example events with no real attendance or payment.</Text>
  {!!eventNotice && <Text accessibilityRole="alert" style={styles.badge}>{eventNotice}</Text>}
  {practiceEvents.map(event => {
   const registered = registrations.some(item => item.eventId===event.id)
   const eligible = !event.membersOnly || summary.active
   return <View key={event.id} style={styles.card}>
    <Text style={styles.heading}>{event.name}</Text>
    <Text style={styles.copy}>{event.membersOnly ? 'Members only · Included with active membership (practice)' : 'Public · No membership required (practice)'}</Text>
    <Text style={styles.copy}>{registered ? eligible ? 'Registered · Practice access available' : 'Registration retained · Access locked until membership is active' : eligible ? 'Eligible to register' : 'Membership required · Try registering to see the block'}</Text>
    {button(`Register for ${event.name}`, () => {
     const result=registerPracticeEvent(event.id,state.membership,registrations,state.now)
     setRegistrations(result.registrations); setEventNotice(result.message)
    })}
    {registered && button(`Cancel ${event.name} registration`, () => { setRegistrations(items => items.filter(item => item.eventId!==event.id)); setEventNotice(`${event.name}: practice registration cancelled.`) })}
   </View>
  })}
  {!state.pending ? <View style={styles.card}>
   <Text style={styles.heading}>{summary.active ? 'Renew or change billing (practice)' : 'Choose paid membership (practice)'}</Text>
   <Text style={styles.copy}>Prices and benefits require team approval. The one-time example lasts 30 days; these are sample terms only.</Text>
   {(['one_time','monthly','annually'] as const).map(period => <TouchableOpacity key={period} accessibilityRole="radio" accessibilityState={{checked:selected===period}} onPress={() => setSelected(period)} style={[styles.choice, selected===period && styles.selected]}><Text style={styles.copy}>{selected===period ? '● ' : '○ '}{period==='one_time' ? 'One-time · no automatic renewal' : period==='monthly' ? 'Monthly subscription' : 'Annual subscription'}</Text></TouchableOpacity>)}
   {button('Review practice checkout', () => apply({type:'checkout',period:selected}))}
  </View> : <View style={styles.card}>
   <Text style={styles.heading}>Awaiting payment verification (practice)</Text>
   <Text style={styles.copy}>In the real flow, CharityStack collects payment and the server verifies it. Opening checkout alone does not activate membership. An existing membership keeps its current access while a renewal is pending.</Text>
   {button('Simulate verified payment', () => apply({type:'confirm'}))}
   {button('Simulate failed / abandoned checkout', () => { apply({type:'fail'}); setNotice('Practice checkout ended. No membership change or charge.') })}
  </View>}
  {summary.active && !state.pending && <View style={styles.card}>
   <Text style={styles.heading}>Manage membership (practice)</Text>
   {state.period !== 'one_time' && state.membership?.source==='charitystack' && !state.membership.cancel_at_period_end && button('Cancel renewal / move to Free', () => setCancelling(true))}
   {cancelling && <><Text style={styles.copy}>Stop future renewals? Current member access continues until the end date, then returns to Free. This practice action does not cancel CharityStack billing.</Text>{button('Confirm practice cancellation', () => { apply({type:'cancel_renewal'}); setCancelling(false) })}{button('Keep practice membership', () => setCancelling(false))}</>}
   {state.membership?.cancel_at_period_end && button('Keep renewing (practice)', () => apply({type:'restore_renewal'}))}
   {button('Preview reminder · 3 days before expiry', () => apply({type:'near_expiry'}))}
   {state.period !== 'one_time' && state.membership?.source === 'charitystack' && button('Simulate overdue renewal', () => { apply({type:'past_due'}); setCancelling(false) })}
   {button('Advance to expiry', () => { apply({type:'expire'}); setCancelling(false) })}
  </View>}
  {state.membership?.status === 'past_due' && <View style={styles.card}><Text style={styles.heading}>Payment overdue (practice)</Text><Text style={styles.copy}>Access is paused. This simulates a server-verified billing status; no subscription is changed. Recovery restores only the remaining recorded period.</Text>{button('Simulate verified billing recovery', () => apply({type:'restore_payment'}))}{button('Advance overdue membership to expiry', () => apply({type:'expire'}))}</View>}
  <View style={styles.card}><Text style={styles.heading}>Sample member content and event</Text><Text style={styles.copy}>{summary.active ? 'Unlocked in this practice screen. Real content/event access must be enforced by the server.' : 'Locked · Requires an active, verified membership.'}</Text></View>
  {!!notice && <Text accessibilityRole="alert" style={styles.copy}>{notice}</Text>}
  {button('Simulate admin complimentary access · 30 days', () => { apply({type:'complimentary'}); setCancelling(false) })}
  {button('Reset practice', () => { setState(initialMembershipDemo()); setSelected('monthly'); setCancelling(false); setNotice(''); setRegistrations([]); setEventNotice('') })}
  {button('Back to real membership', () => router.replace('/membership'))}
 </ScrollView>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#F5F8F7'},content:{padding:24,gap:16,paddingBottom:48,maxWidth:700,width:'100%',alignSelf:'center'},badge:{color:'#62470C',backgroundColor:'#FFF2CD',padding:14,fontWeight:'700'},title:{fontSize:28,fontWeight:'700',color:'#172B28'},heading:{fontSize:20,fontWeight:'600',color:'#172B28'},copy:{fontSize:16,lineHeight:24,color:'#425550'},card:{backgroundColor:'#fff',borderRadius:16,padding:20,gap:14},button:{backgroundColor:'#0E7C7A',padding:16,borderRadius:10},buttonText:{color:'#fff',fontWeight:'600',textAlign:'center'},choice:{padding:14,borderWidth:1,borderColor:'#ddd',borderRadius:10},selected:{borderColor:'#0E7C7A',backgroundColor:'#E0F2EA'}})
