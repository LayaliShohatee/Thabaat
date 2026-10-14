import { useCallback, useRef, useState } from 'react'
import { AppState, ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { useAuth } from '@/hooks/useAuth'
import { beginPaidEventOrder, getPaidEventOrder, openPaidEventCheckout } from '@/services/paidEventService'
import { getEventById } from '@/services/eventService'
import { money } from '@/lib/billing'
import { paidTestEventId, paidTestTicketId } from '@/lib/paid-event-test'
import { isPaymentCheckEnabled } from '@/lib/payment-check'

export default function PaidEventCheckoutScreen() {
 const { eventId } = useLocalSearchParams<{ eventId: string }>()
 const { user } = useAuth()
 const [busy,setBusy] = useState(false)
 const [message,setMessage] = useState('')
 const opening = useRef(false)
 const allowed = isPaymentCheckEnabled && eventId === paidTestEventId
 const load = useCallback(async () => {
  if (!allowed || !user) return null
  const [event,order] = await Promise.all([getEventById(eventId),getPaidEventOrder(eventId)])
  if (!event) throw new Error('Test event not found.')
  return { event, order }
 },[allowed,eventId,user])
 const { data,loading,error,reload } = useFocusResource(load,null)
 useFocusEffect(useCallback(() => {
  let checks=0
  const timer=setInterval(() => { if (++checks<=4) void reload(); else clearInterval(timer) },15000)
  const listener=AppState.addEventListener('change', state => { if(state==='active') void reload() })
  return () => { clearInterval(timer); listener.remove() }
 },[reload]))
 async function prepare() {
  if (!allowed || !user || opening.current) return
  opening.current=true; setBusy(true); setMessage('')
  try { await beginPaidEventOrder(paidTestTicketId); await reload() }
  catch(err) { setMessage(err instanceof Error ? err.message : 'Unable to prepare checkout.') }
  finally { opening.current=false; setBusy(false) }
 }
 async function open() {
  if (!allowed || !user || !data?.order || data.order.status!=='pending' || opening.current) return
  opening.current=true; setBusy(true); setMessage('')
  try { await openPaidEventCheckout(data.order); setMessage('If you paid, do not pay again. Return here after the team verifies your CharityStack payment, then refresh.'); await reload() }
  catch(err) { setMessage(err instanceof Error ? err.message : 'Unable to open checkout.') }
  finally { opening.current=false; setBusy(false) }
 }
 const order=data?.order
 if(!allowed) return <View style={styles.page}><Text style={styles.text}>This internal paid-event test is not enabled.</Text></View>
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.title}>{data?.event.title ?? 'Paid Access Test'}</Text>
  <Text style={styles.text}>One real $1 payment for an internal app test. No admission to a real-world event. Review the final total and any fees before paying.</Text>
  <View style={styles.card}>
   <Text style={styles.heading}>{order?.status === 'completed' ? 'Payment verified · Access unlocked' : order?.status === 'refunded' ? 'Payment refunded · Access locked' : order?.status === 'cancelled' ? 'Checkout cancelled' : order ? 'Awaiting manual payment verification' : 'Access locked'}</Text>
   <Text style={styles.text}>A team member must check the actual CharityStack payment before your ticket and private event page unlock. This is not automatic yet.</Text>
   {order && <><Text style={styles.text}>{money(order.amount_cents,order.currency)}</Text><Text style={styles.text}>Press and hold to copy your checkout reference:</Text><Text selectable style={styles.reference}>{order.id}</Text><Text style={styles.text}>Enter this reference in CharityStack’s “Thabaat app checkout reference” field. Use your Thabaat account email: {user?.email}</Text></>}
  </View>
  {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!message && <Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
  {!order && <TouchableOpacity accessibilityRole="button" disabled={loading || busy || !user || !!error} style={styles.button} onPress={prepare}><Text>{busy ? 'Preparing…' : 'Prepare $1 checkout'}</Text></TouchableOpacity>}
  {order?.status==='pending' && <TouchableOpacity accessibilityRole="button" disabled={busy || !user} style={styles.button} onPress={open}><Text>{busy ? 'Opening…' : 'Open CharityStack · Pay once'}</Text></TouchableOpacity>}
  <TouchableOpacity accessibilityRole="button" disabled={loading} style={styles.button} onPress={() => void reload()}><Text>{loading ? 'Checking…' : 'Refresh payment status'}</Text></TouchableOpacity>
  {order?.status==='completed' && <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push(`/event/access/${eventId}`)}><Text>Open paid event access</Text></TouchableOpacity>}
  <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.replace('/(tabs)/events?view=tickets')}><Text>My tickets</Text></TouchableOpacity>
 </ScrollView>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000'},content:{padding:24,gap:18,paddingBottom:48,maxWidth:650,width:'100%',alignSelf:'center'},title:{color:'#fff',fontSize:26,fontWeight:'700'},heading:{color:'#c4f2d6',fontSize:20,fontWeight:'600'},text:{color:'#ddd',fontSize:16,lineHeight:24},card:{backgroundColor:'#151515',padding:20,borderRadius:14,gap:14},reference:{color:'#fff',fontSize:17,lineHeight:26,fontWeight:'600'},error:{color:'#ffb4b4',fontSize:16},button:{backgroundColor:'#fff',borderRadius:10,padding:16,alignItems:'center'}})
