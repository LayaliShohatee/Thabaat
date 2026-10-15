import { useState } from 'react'
import { brand, fonts, links, shadow } from '@/constants/brand'
import { Linking, ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { router } from 'expo-router'
import { isDemoMode } from '@/lib/demo-mode'

// Account: who you are, a few account actions, and everything else tucked under More.
export default function AccountScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
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
  const name = user?.user_metadata?.full_name || 'Thabaat member'
  const initials = String(name).split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()
  const row = (label: string, onPress: () => void) => <TouchableOpacity key={label} accessibilityRole="button" disabled={busy} style={styles.row} onPress={onPress}>
    <Text style={styles.rowText}>{label}</Text><Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}>
    <Text style={styles.title}>Account</Text>
    <View style={styles.identity}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.name}>{name}</Text><Text style={styles.detail}>{user?.email}</Text></View>
    </View>
    <View style={styles.group}>
      {row('Edit profile', () => router.push('/profile/edit'))}
      {row('Change password', () => router.push('/auth/change-password'))}
      {!isDemoMode && row('More', () => router.push('/more'))}
    </View>
    <View style={styles.group}>
      {row('FAQ', () => router.push('/faq'))}
      {row('Follow Thabaat', () => void Linking.openURL(links.social))}
    </View>
    <TouchableOpacity accessibilityRole="button" style={styles.logout} disabled={busy} onPress={logout}><Text style={styles.logoutText}>{busy ? 'Please wait…' : 'Log out'}</Text></TouchableOpacity>
    {message ? <Text style={styles.detail} accessibilityRole="alert">{message}</Text> : null}
  </ScrollView>
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.page },
  container: { padding: 20, gap: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontFamily: fonts.headingHeavy, color: brand.ink },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: brand.card, borderRadius: brand.radius, padding: 18, ...shadow },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: brand.forest, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: brand.zayt, fontFamily: fonts.heading, fontSize: 18 },
  name: { fontSize: 18, fontFamily: fonts.heading, color: brand.ink },
  detail: { color: brand.inkMuted, marginTop: 2 },
  group: { backgroundColor: brand.card, borderRadius: brand.radius, paddingHorizontal: 18, borderWidth: 1, borderColor: brand.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: brand.line },
  rowText: { color: brand.ink, fontSize: 16, fontFamily: fonts.label },
  chevron: { color: brand.inkMuted, fontSize: 18 },
  logout: { paddingVertical: 15, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: brand.danger },
  logoutText: { color: brand.danger, fontFamily: fonts.label, fontSize: 16 },
})
