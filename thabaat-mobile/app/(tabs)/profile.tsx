import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { registerForPushNotifications } from '@/lib/notifications'
import { router } from 'expo-router'

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
  return <View style={styles.container}>
    <Text style={styles.title}>Profile</Text>
    <Text style={styles.detail}>{user?.user_metadata?.full_name || 'Thabaat member'}</Text>
    <Text style={styles.detail}>{user?.email}</Text>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/profile/edit')}><Text>Edit Profile</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/auth/change-password')}><Text>Change Password</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push('/membership')}><Text>Membership Preview</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={busy} onPress={enableNotifications}><Text>Enable Notifications</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={busy} onPress={logout}><Text>{busy ? 'Please wait...' : 'Log Out'}</Text></TouchableOpacity>
    {message ? <Text style={styles.detail} accessibilityRole="alert">{message}</Text> : null}
  </View>
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  detail: { color: '#eee', marginBottom: 12 },
  button: { backgroundColor: '#fff', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
})
