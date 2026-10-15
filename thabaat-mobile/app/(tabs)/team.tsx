import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { router } from 'expo-router'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getManagementEvents, getPermissions } from '@/services/managementService'
import { getVolunteerWork } from '@/services/staffService'
import { appRole } from '@/lib/app-role'
import EventAttendanceRoster from '@/components/EventAttendanceRoster'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle'

type TeamEvent = { id: string; title: string; date: string; location?: string; duty?: string; canSeeRoster: boolean }

// Team view: the event-day screen for volunteers and admins. Start check-in, see who registered, look back at past events.
async function loadTeamEvents(): Promise<TeamEvent[]> {
  const permissions = await getPermissions()
  if (appRole(permissions) === 'admin') {
    const events = await getManagementEvents()
    return events
      .filter(e => permissions.staff_role === 'admin' || e.created_by === permissions.user_id)
      .map(e => ({ id: e.id, title: e.title, date: e.event_date, location: e.location, canSeeRoster: true }))
  }
  const work = await getVolunteerWork()
  return work.assignments
    .filter(s => s.active)
    .map(s => ({ id: s.event_id, title: s.title || 'Event', date: s.shift_start, duty: s.duty, canSeeRoster: false }))
}

export default function TeamTab() {
  useStatusBarStyle('dark')
  const { data, loading, error, reload } = useFocusResource(loadTeamEvents, [] as TeamEvent[])
  const [view, setView] = useState<'upcoming' | 'archive'>('upcoming')
  const [rosterEvent, setRosterEvent] = useState<string | null>(null)
  const [now] = useState(Date.now)
  // An event stays under Upcoming until 12 hours after it starts, so it is still there during check-in.
  const isPast = (e: TeamEvent) => new Date(e.date).getTime() + 12 * 3600000 < now
  const shown = data.filter(e => (view === 'archive') === isPast(e)).sort((a, b) => (view === 'archive' ? -1 : 1) * (new Date(a.date).getTime() - new Date(b.date).getTime()))

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Team view</Text>
    <Text style={styles.text}>Your events for check-in and event day.</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(['upcoming', 'archive'] as const).map(value => <PressableScale key={value} accessibilityRole="tab" accessibilityState={{ selected: view === value }} onPress={() => setView(value)} hitSlop={4}
        style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: view === value ? brand.navy : brand.card, borderWidth: 1, borderColor: view === value ? brand.navy : brand.line }}>
        <Text style={{ fontFamily: fonts.label, color: view === value ? '#FFFFFF' : brand.ink }}>{value === 'upcoming' ? 'Upcoming' : 'Archive'}</Text>
      </PressableScale>)}
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
    {loading && !data.length && <Text style={styles.text}>Loading your events…</Text>}
    {!loading && !error && !shown.length && <Text style={styles.text}>{view === 'upcoming' ? 'No upcoming events assigned to you yet.' : 'No past events yet.'}</Text>}
    {shown.map(event => <View key={event.id} style={styles.card}>
      <Text style={styles.heading}>{event.title}</Text>
      <Text style={styles.text}>{new Date(event.date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{event.location ? ` · ${event.location}` : ''}</Text>
      {!!event.duty && <Text style={styles.text}>Your role: {event.duty}</Text>}
      {view === 'upcoming' && <Button label="Start check-in" onPress={() => router.push(`/check-in/${event.id}`)} />}
      {event.canSeeRoster && <PressableScale accessibilityRole="button" onPress={() => setRosterEvent(rosterEvent === event.id ? null : event.id)}>
        <Text style={{ color: brand.primary, fontFamily: fonts.label, textAlign: 'center', paddingVertical: 6 }}>{rosterEvent === event.id ? 'Hide registered people' : 'See who’s registered'}</Text>
      </PressableScale>}
      {rosterEvent === event.id && <EventAttendanceRoster eventId={event.id} />}
    </View>)}
    <Button label={loading ? 'Refreshing…' : 'Refresh'} disabled={loading} onPress={() => void reload()} />
  </ScrollView>
}
