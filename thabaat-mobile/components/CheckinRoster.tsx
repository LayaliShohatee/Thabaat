import { useCallback, useRef, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { addWalkIn, checkInRegistration, getCheckinRoster, removeWalkIn, type CheckinRoster as Roster, type RosterPerson } from '@/services/volunteerCheckinService'
import { filterRoster } from '@/lib/checkin-roster'
import { formatEventTime } from '@/lib/event-time'
import { ManagementButton as Button, ManagementLink as Link, managementStyles as styles } from './ManagementUI'

// Event-day list: search a name, tap "Check in" next to it. Walk-ins can be added on the spot.
// readOnly shows the list without check-in buttons (e.g. a volunteer looking ahead before their shift).
export function CheckinRoster({ eventId, readOnly = false }: { eventId: string; readOnly?: boolean }) {
 const load = useCallback(() => getCheckinRoster(eventId), [eventId])
 const { data, loading, error, reload } = useFocusResource(load, null as Roster | null, 10000)
 const [search, setSearch] = useState(''), [busy, setBusy] = useState<string | null>(null), [message, setMessage] = useState('')
 const [walkIn, setWalkIn] = useState<{ name: string; contact: string } | null>(null)
 const locked = useRef(false)
 async function run(key: string, action: () => Promise<string>) {
  if (locked.current) return
  locked.current = true; setBusy(key); setMessage('')
  try { setMessage(await action()); await reload() } catch (e) { setMessage(e instanceof Error ? e.message : 'Something went wrong. Try again.') } finally { locked.current = false; setBusy(null) }
 }
 const checkIn = (p: RosterPerson) => void run(p.id, async () => {
  const result = await checkInRegistration(eventId, p.id)
  return result.already_checked_in ? `${result.full_name} was already checked in at ${formatEventTime(result.checked_in_at, undefined, { hour: 'numeric', minute: '2-digit' })}.` : `${result.full_name} is checked in.`
 })
 const saveWalkIn = () => walkIn && void run('walk-in', async () => {
  const added = await addWalkIn(eventId, walkIn.name, walkIn.contact)
  setWalkIn(null); setSearch('')
  return `${added.full_name} added as a walk-in and checked in.`
 })

 if (!data) return <View style={styles.card}>{error ? <Text accessibilityRole="alert" style={styles.alert}>{error}</Text> : <Text style={styles.text}>{loading ? 'Loading the guest list…' : ''}</Text>}</View>
 const canCheckIn = data.can_check_in && !readOnly
 const people = filterRoster(data.people, search)
 const remaining = Math.max(0, data.confirmed - data.checked_in)

 return <View style={{ gap: 12 }}>
  <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14 }]}>
   {([[data.checked_in + data.walk_ins, 'Checked in'], [remaining, 'Still to come'], [data.walk_ins, 'Walk-ins']] as const).map(([n, label]) => <View key={label} style={{ alignItems: 'center' }}>
    <Text style={{ fontFamily: fonts.headingHeavy, fontSize: 22, color: brand.ink }}>{n}</Text><Text style={[styles.text, { fontSize: 13 }]}>{label}</Text>
   </View>)}
  </View>
  {!data.can_check_in && !readOnly && <Text style={styles.alert}>You can see the list now. Check-in opens {data.check_in_opens_at ? formatEventTime(data.check_in_opens_at) : 'closer to the event'} (volunteers: 30 minutes before your shift).</Text>}
  <TextInput accessibilityLabel="Search guest name" placeholder="Search a name" placeholderTextColor={brand.inkMuted} value={search} onChangeText={setSearch} style={styles.input} autoCorrect={false} />
  {!!message && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.alert}>{message}</Text>}
  <View style={[styles.card, { gap: 0, paddingVertical: 4 }]}>
   {!people.length && <Text style={[styles.text, { paddingVertical: 12 }]}>{search ? `No one named “${search}”.` : 'No one has registered yet.'}</Text>}
   {people.map(p => <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: brand.line }}>
    <View style={{ flex: 1 }}>
     <Text style={{ fontFamily: fonts.label, fontSize: 16, color: brand.ink }}>{p.full_name}</Text>
     <Text style={[styles.text, { fontSize: 13 }]}>{p.ticket_name}{p.checked_in_at ? ` · in at ${formatEventTime(p.checked_in_at, undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</Text>
     {p.kind === 'walk_in' && canCheckIn && <Link label={`Remove walk-in ${p.full_name}`} color={brand.danger} disabled={!!busy} onPress={() => void run(p.id, async () => { await removeWalkIn(p.id); return `${p.full_name} removed.` })} />}
    </View>
    {p.checked_in_at
     ? <Text accessibilityLabel={`${p.full_name} checked in`} style={{ color: brand.primary, fontFamily: fonts.heading, fontSize: 14 }}>✓ In</Text>
     : canCheckIn && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Check in ${p.full_name}`} disabled={!!busy} onPress={() => checkIn(p)}
        style={{ backgroundColor: brand.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, opacity: busy && busy !== p.id ? 0.5 : 1 }}>
        <Text style={{ color: '#FFFFFF', fontFamily: fonts.label }}>{busy === p.id ? '…' : 'Check in'}</Text>
       </TouchableOpacity>}
   </View>)}
  </View>
  {canCheckIn && (walkIn ? <View style={styles.card}>
   <Text style={styles.heading}>Add a walk-in</Text>
   <TextInput accessibilityLabel="Walk-in full name" placeholder="Full name" value={walkIn.name} onChangeText={name => setWalkIn({ ...walkIn, name })} style={styles.input} />
   <TextInput accessibilityLabel="Walk-in phone or email" placeholder="Phone or email (optional)" value={walkIn.contact} onChangeText={contact => setWalkIn({ ...walkIn, contact })} style={styles.input} autoCapitalize="none" />
   <Button label={busy === 'walk-in' ? 'Adding…' : 'Add and check in'} disabled={!!busy || walkIn.name.trim().length < 2} onPress={saveWalkIn} />
   <Link label="Cancel" color={brand.inkMuted} onPress={() => setWalkIn(null)} />
  </View> : <Button label="+ Add walk-in" disabled={!!busy} onPress={() => setWalkIn({ name: search, contact: '' })} />)}
 </View>
}
