import { useCallback, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { router } from 'expo-router'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getManagementEvents, getPermissions, type ManagedEvent, type Permissions } from '@/services/managementService'
import { EVENT_TZ, formatEventTime } from '@/lib/event-time'
import { upcomingFirst } from '@/lib/ticket-order'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle'

const SHORTCUTS = [['Roles and access', '/admin/roles'], ['Account suspensions', '/staff-accounts'], ['Analytics', '/staff-analytics'], ['Campaigns and donations', '/staff-campaigns'], ['Membership plans', '/staff-memberships'], ['Send a notification', '/notification-broadcast']] as const

// Admin: shortcuts to admin pages, then the events you manage. Tap an event to manage it.
export default function AdminTab() {
  useStatusBarStyle('dark')
 const load = useCallback(async () => {
  const events = await getManagementEvents()
  try { return { events, permissions: await getPermissions(), setupError: '' } }
  catch (e) { return { events, permissions: null, setupError: e instanceof Error ? e.message : 'Unable to load permissions' } }
 }, [])
 const { data, loading, error, reload } = useFocusResource(load, { events: [] as ManagedEvent[], permissions: null as Permissions | null, setupError: '' })
 const [search, setSearch] = useState('')
 const manages = (event: ManagedEvent) => !!data.permissions?.can_manage_events && (data.permissions.staff_role === 'admin' || event.created_by === data.permissions.user_id)
 const [now] = useState(Date.now)
 const time = (e: ManagedEvent) => Date.parse(e.event_date)
 const events = upcomingFirst(data.events.filter(e => manages(e) && `${e.title} ${e.location}`.toLowerCase().includes(search.toLowerCase())), time, now)

 return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Text style={styles.title}>Admin</Text>
  {data.permissions?.can_manage_roles && <View style={[styles.card, { gap: 0, paddingVertical: 4 }]}>
   {SHORTCUTS.map(([label, href]) => <PressableScale key={href} accessibilityRole="button" onPress={() => router.push(href)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderColor: brand.line }}>
    <Text style={{ color: brand.ink, fontSize: 15, fontFamily: fonts.label }}>{label}</Text><Text style={{ color: brand.inkMuted }}>›</Text>
   </PressableScale>)}
  </View>}
  <Text style={[styles.heading, { marginTop: 6 }]}>Events</Text>
  {!!(error || data.setupError) && <Text accessibilityRole="alert" style={styles.alert}>{error || data.setupError}</Text>}
  {data.permissions?.can_manage_events && <Button label="+ Create event" onPress={() => router.push('/admin/event/new')} />}
  <TextInput accessibilityLabel="Search events" placeholder="Search title or location" placeholderTextColor={brand.inkMuted} value={search} onChangeText={setSearch} style={styles.input} />
  {events.map(event => <PressableScale key={event.id} accessibilityRole="button" accessibilityLabel={`Manage ${event.title}`} onPress={() => router.push(`/admin/manage/${event.id}`)}
   style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
   <View style={{ flex: 1, gap: 4 }}>
    <Text style={styles.heading}>{event.title}</Text>
    <Text style={styles.text}>{formatEventTime(event.event_date, event.timezone || EVENT_TZ)} · {event.location}{time(event) < now ? ' · Past' : ''}</Text>
   </View>
   <Text style={{ color: brand.primary, fontFamily: fonts.label }}>Manage ›</Text>
  </PressableScale>)}
  {!loading && !events.length && <Text style={styles.text}>{search ? 'No matching events.' : 'No events to manage yet.'}</Text>}
  <PressableScale accessibilityRole="button" disabled={loading} onPress={() => void reload()}><Text style={{ color: brand.primary, fontFamily: fonts.label, textAlign: 'center' }}>{loading ? 'Refreshing…' : 'Refresh'}</Text></PressableScale>
 </ScrollView>
}
