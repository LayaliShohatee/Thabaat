import { useCallback, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { archiveEvent, getManagementEvents, getPermissions } from '@/services/managementService'
import { getStaffReport } from '@/services/staffService'
import { exportCsvFile } from '@/lib/csv-export'
import { eventRegistrationCsv } from '@/lib/staff-reporting'
import { EVENT_TZ, formatEventTime } from '@/lib/event-time'
import { FreeTicketInventory } from '@/components/FreeTicketInventory'
import { EventRefundsAndCodes } from '@/components/EventRefundsAndCodes'
import { EventAttendees } from '@/components/EventAttendees'
import { EventVolunteers } from '@/components/EventVolunteers'
import { PublicEventPublisher } from '@/components/PublicEventPublisher'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'

const SECTIONS = [['overview', 'Overview'], ['tickets', 'Tickets'], ['volunteers', 'Volunteers'], ['attendees', 'Attendees']] as const
type Section = typeof SECTIONS[number][0]

// Everything for one event, grouped into four sections instead of a long row of buttons.
export default function ManageEvent() {
 const { id, section: initial } = useLocalSearchParams<{ id: string; section?: string }>()
 const load = useCallback(async () => {
  const [events, permissions] = await Promise.all([getManagementEvents(), getPermissions()])
  const event = events.find(e => e.id === id)
  if (!event) throw new Error('This event could not be found or was archived.')
  return { event, isAdmin: permissions.staff_role === 'admin' }
 }, [id])
 const { data, loading, error } = useFocusResource(load, null as Awaited<ReturnType<typeof load>> | null)
 const [section, setSection] = useState<Section>(SECTIONS.some(([s]) => s === initial) ? initial as Section : 'overview')
 const [showPublic, setShowPublic] = useState(false), [confirmArchive, setConfirmArchive] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const locked = useRef(false)
 async function run(action: () => Promise<void>) {
  if (locked.current) return
  locked.current = true; setBusy(true); setMessage('')
  try { await action() } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed') } finally { locked.current = false; setBusy(false) }
 }
 const link = (label: string, onPress: () => void, color: string = brand.primary) => <PressableScale accessibilityRole="button" disabled={busy} onPress={onPress} style={{ paddingVertical: 13, borderTopWidth: 1, borderColor: brand.line, flexDirection: 'row', justifyContent: 'space-between' }}>
  <Text style={{ color, fontFamily: fonts.label, fontSize: 15 }}>{label}</Text><Text style={{ color: brand.inkMuted }}>›</Text>
 </PressableScale>

 if (!data) return <><Stack.Screen options={{ title: 'Manage event' }} /><View style={[styles.page, styles.content, { paddingTop: 20 }]}>{error ? <Text accessibilityRole="alert" style={styles.alert}>{error}</Text> : <Text style={styles.text}>{loading ? 'Loading event…' : ''}</Text>}</View></>
 const { event, isAdmin } = data
 const tz = event.timezone || EVENT_TZ

 return <><Stack.Screen options={{ title: 'Manage event' }} />
  <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: 20 }]} keyboardShouldPersistTaps="handled">
   <View style={{ gap: 4 }}>
    <Text style={[styles.title, { fontSize: 24 }]}>{event.title}</Text>
    <Text style={styles.text}>{formatEventTime(event.event_date, tz, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {event.location}</Text>
   </View>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {SECTIONS.map(([value, label]) => <PressableScale key={value} accessibilityRole="tab" accessibilityState={{ selected: section === value }} onPress={() => setSection(value)} haptic="selection" hitSlop={4}
     style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: section === value ? brand.forest : brand.card, borderWidth: 1, borderColor: section === value ? brand.forest : brand.line }}>
     <Text style={{ color: section === value ? brand.page : brand.ink, fontFamily: fonts.label }}>{label}</Text>
    </PressableScale>)}
   </View>
   {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}

   {section === 'overview' && <>
    <View style={styles.card}>
     <Text style={styles.text}>Capacity: {event.capacity} · {event.age_min ? `Ages ${event.age_min}+` : 'All ages'}{event.members_only ? ' · Members only' : ''}</Text>
     <Button label="Edit event details" disabled={busy} onPress={() => router.push(`/admin/event/${event.id}`)} />
     <View>
      {link('View event page', () => router.push(`/event/${event.id}`))}
      {link('Start check-in', () => router.push(`/check-in/${event.id}`))}
      {link('Waitlist', () => router.push(`/waitlist/manage/${event.id}`))}
      {isAdmin && link(showPublic ? 'Hide public sign-up page' : 'Public sign-up page', () => setShowPublic(!showPublic))}
      {link('Archive event', () => setConfirmArchive(true), brand.danger)}
     </View>
    </View>
    {confirmArchive && <View style={styles.card}>
     <Text style={styles.text}>Archive this event? It disappears from listings and registration closes. Existing bookings must be resolved first.</Text>
     <Button label={busy ? 'Archiving…' : 'Yes, archive'} disabled={busy} onPress={() => void run(async () => { await archiveEvent(event.id); router.back() })} />
     <PressableScale accessibilityRole="button" onPress={() => setConfirmArchive(false)}><Text style={{ color: brand.inkMuted, fontFamily: fonts.label, textAlign: 'center' }}>Keep event</Text></PressableScale>
    </View>}
    {isAdmin && showPublic && <PublicEventPublisher event={event} />}
   </>}
   {section === 'tickets' && <><FreeTicketInventory eventId={event.id} /><EventRefundsAndCodes eventId={event.id} refundDeadline={(event as { refund_deadline?: string | null }).refund_deadline} /></>}
   {section === 'volunteers' && <EventVolunteers eventId={event.id} />}
   {section === 'attendees' && <>
    <Button label="Start check-in" onPress={() => router.push(`/check-in/${event.id}`)} />
    <EventAttendees eventId={event.id} />
    <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { await exportCsvFile(eventRegistrationCsv(await getStaffReport(event.id)), 'thabaat-registrations.csv', 'Thabaat registrations'); setMessage('Registrations exported. Contact details are left out.') })}>
     <Text style={{ color: brand.primary, fontFamily: fonts.label, textAlign: 'center' }}>Export registrations (CSV)</Text>
    </PressableScale>
   </>}
  </ScrollView></>
}
