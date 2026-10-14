import { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { brand, fonts } from '@/constants/brand'
import { useAuth } from '@/hooks/useAuth'
import { registerForPushNotifications } from '@/lib/notifications'
import { paidTestEventId } from '@/lib/paid-event-test'
import { isPaymentCheckEnabled } from '@/lib/payment-check'
import { VolunteerApplication } from '@/components/VolunteerApplication'
import { managementStyles as styles } from '@/components/ManagementUI'

// Everything that used to crowd the Account page, grouped as a quiet list.
const rows: [string, Href][] = [
 ['Membership', '/membership'],
 ['Support Thabaat', '/donations'],
 ['Payment history', '/payments/history'],
 ['Ticket gifts', '/ticket-gifts'],
 ['Friends and event invitations', '/friends'],
 ['Media library', '/media'],
 ['Notification preferences', '/notifications'],
]

export default function MoreScreen() {
 const { user } = useAuth()
 const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
 async function enableNotifications() {
  if (!user || busy) return
  setBusy(true)
  try { setMessage(await registerForPushNotifications(user.id)) }
  catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to enable notifications.') }
  finally { setBusy(false) }
 }
 const row = (label: string, onPress: () => void, key = label) => <TouchableOpacity key={key} accessibilityRole="button" disabled={busy} onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderColor: brand.line }}>
  <Text style={{ color: brand.ink, fontSize: 16, fontFamily: fonts.label }}>{label}</Text><Text style={{ color: brand.inkMuted, fontSize: 16 }}>›</Text>
 </TouchableOpacity>
 return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: 20 }]}>
  <View style={[styles.card, { gap: 0, paddingVertical: 4 }]}>
   {rows.map(([label, href]) => row(label, () => router.push(href)))}
   {row(busy ? 'Please wait…' : 'Turn on notifications', () => void enableNotifications())}
   {isPaymentCheckEnabled && row('Paid event test · $1 real payment', () => router.push(`/event/${paidTestEventId}`))}
  </View>
  {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  <VolunteerApplication />
 </ScrollView>
}
