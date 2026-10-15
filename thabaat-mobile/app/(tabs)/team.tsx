import { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getManagementEvents, getPermissions } from '@/services/managementService'
import { getVolunteerWork } from '@/services/staffService'
import { appRole } from '@/lib/app-role'
import { CheckinRoster } from '@/components/CheckinRoster'
import { cancelMyVolunteerSignup, getMyVolunteerSignups, type MyVolunteerSignup } from '@/services/volunteerCheckinService'
import { EVENT_TZ, formatEventTime } from '@/lib/event-time'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'

type TeamEvent = { id: string; title: string; date: string; location?: string; duty?: string; isLead?: boolean; roleDescription?: string }
type TeamData = { events: TeamEvent[]; pending: MyVolunteerSignup[] }

// Team view: the event-day screen for volunteers and admins. Start check-in, see who registered, look back at past events.
async function loadTeamEvents(): Promise<TeamData> {
  const permissions = await getPermissions()
  // Sign-ups waiting for a decision; an older database without the sign-up feature just shows none.
  const pending = (await getMyVolunteerSignups().catch(() => [])).filter(s => s.status === 'requested')
  if (appRole(permissions) === 'admin') {
    const events = await getManagementEvents()
    return { pending, events: events
      .filter(e => permissions.staff_role === 'admin' || e.created_by === permissions.user_id)
      .map(e => ({ id: e.id, title: e.title, date: e.event_date, location: e.location })) }
  }
  const work = await getVolunteerWork()
  return { pending, events: work.assignments
    .filter(s => s.active)
    .map(s => ({ id: s.event_id, title: s.title || 'Event', date: s.event_date || s.shift_start, location: s.location, duty: s.duty, isLead: s.is_lead, roleDescription: s.role_description })) }
}

export default function TeamTab() {
  const { data: team, loading, error, reload } = useFocusResource(loadTeamEvents, { events: [], pending: [] } as TeamData)
  const data = team.events
  const [cancelling, setCancelling] = useState<string | null>(null), [notice, setNotice] = useState('')
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
      {(['upcoming', 'archive'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: view === value }} onPress={() => setView(value)}
        style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: view === value ? brand.forest : brand.card, borderWidth: 1, borderColor: view === value ? brand.forest : brand.line }}>
        <Text style={{ fontFamily: fonts.label, color: view === value ? brand.page : brand.ink }}>{value === 'upcoming' ? 'Upcoming' : 'Archive'}</Text>
      </TouchableOpacity>)}
    </View>
    {view === 'upcoming' && team.pending.length > 0 && <View style={[styles.card, { borderWidth: 1, borderColor: brand.zayt }]}>
      <Text style={styles.heading}>Waiting for the team to confirm</Text>
      {team.pending.map(s => <View key={s.event_id} style={{ gap: 2, paddingVertical: 6, borderTopWidth: 1, borderColor: brand.line }}>
        <Text style={{ fontFamily: fonts.label, color: brand.ink }}>{s.title}</Text>
        <Text style={styles.text}>{formatEventTime(s.event_date, EVENT_TZ)}{s.preferred_role ? ` · You asked for: ${s.preferred_role}` : ''}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Cancel volunteer sign-up for ${s.title}`} disabled={!!cancelling} onPress={() => { setCancelling(s.event_id); setNotice(''); void cancelMyVolunteerSignup(s.event_id).then(reload, e => setNotice(e instanceof Error ? e.message : 'Unable to cancel. Try again.')).finally(() => setCancelling(null)) }}>
          <Text style={{ color: brand.danger, fontFamily: fonts.label }}>{cancelling === s.event_id ? 'Cancelling…' : 'Cancel sign-up'}</Text>
        </TouchableOpacity>
      </View>)}
    </View>}
    {!!(error || notice) && <Text accessibilityRole="alert" style={styles.alert}>{error || notice}</Text>}
    {loading && !data.length && <Text style={styles.text}>Loading your events…</Text>}
    {!loading && !error && !shown.length && <Text style={styles.text}>{view === 'upcoming' ? 'No upcoming events assigned to you yet.' : 'No past events yet.'}</Text>}
    {shown.map(event => <View key={event.id} style={styles.card}>
      <Text style={styles.heading}>{event.title}</Text>
      <Text style={styles.text}>{formatEventTime(event.date, EVENT_TZ)}{event.location ? ` · ${event.location}` : ''}</Text>
      {!!event.duty && <Text style={styles.text}>Your role: {event.duty}{event.isLead ? ' · Volunteer lead' : ''}</Text>}
      {!!event.roleDescription && <Text style={styles.text}>{event.roleDescription}</Text>}
      {view === 'upcoming' && <Button label="Start check-in" onPress={() => router.push(`/check-in/${event.id}`)} />}
      <TouchableOpacity accessibilityRole="button" onPress={() => setRosterEvent(rosterEvent === event.id ? null : event.id)}>
        <Text style={{ color: brand.primary, fontFamily: fonts.label, textAlign: 'center', paddingVertical: 6 }}>{rosterEvent === event.id ? 'Hide registered people' : 'See who’s registered'}</Text>
      </TouchableOpacity>
      {rosterEvent === event.id && <CheckinRoster eventId={event.id} readOnly />}
    </View>)}
    <Button label={loading ? 'Refreshing…' : 'Refresh'} disabled={loading} onPress={() => void reload()} />
  </ScrollView>
}
