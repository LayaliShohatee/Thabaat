import { useState } from 'react'
import { brand } from '@/constants/brand'
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { registerForPushNotifications } from '@/lib/notifications'
import { paidTestEventId } from '@/lib/paid-event-test'
import { isPaymentCheckEnabled } from '@/lib/payment-check'
import { router } from 'expo-router'
import { isDemoMode } from '@/lib/demo-mode'

export default function ProfileScreen() {
  const { user } = useAuth()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function logout() {
    if (busy) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.replace('/auth/login')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to log out.') }
    finally { setBusy(false) }
  }
  async function enableNotifications() {
    if (!user || busy) return
    setBusy(true)
    try { setMessage(await registerForPushNotifications(user.id)) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to enable notifications.') }
    finally { setBusy(false) }
  }
  return <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
    <Text style={styles.title}>Profile</Text>
    <Text style={styles.detail}>{user?.user_metadata?.full_name || 'Thabaat member'}</Text>
    <Text style={styles.detail}>{user?.email}</Text>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/profile/edit')}><Text>Edit Profile</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/auth/change-password')}><Text>Change Password</Text></TouchableOpacity>
    {!isDemoMode && <><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/membership')}><Text>Membership</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/donations')}><Text>Support Thabaat</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/payments/history')}><Text>Payment History</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/ticket-gifts')}><Text>Ticket gifts</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/friends')}><Text>Friends and event invitations</Text></TouchableOpacity>
    {isPaymentCheckEnabled && <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push(`/event/${paidTestEventId}`)}><Text>Paid Event Test · $1 real payment</Text></TouchableOpacity>}
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/media')}><Text>Media Library</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/notifications')}><Text>Notification Preferences</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={busy} onPress={enableNotifications}><Text>Enable Notifications</Text></TouchableOpacity></>}
    <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={busy} onPress={logout}><Text>{busy ? 'Please wait...' : 'Log Out'}</Text></TouchableOpacity>
    {message ? <Text style={styles.detail} accessibilityRole="alert">{message}</Text> : null}
  </ScrollView>
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.page },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: brand.ink, marginBottom: 16 },
  detail: { color: brand.inkMuted, marginBottom: 12 },
  button: { backgroundColor: brand.green, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
})
