import { useCallback, useRef, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { cancelMyVolunteerSignup, getMyVolunteerSignups, signUpToVolunteer, type MyVolunteerSignup, type VolunteerAnswers } from '@/services/volunteerCheckinService'
import { ManagementButton as Button, ManagementChip as Chip, ManagementLink as Link, managementStyles as styles } from './ManagementUI'

// PLACEHOLDER questions until the client sends their volunteer form. Swap these three for theirs.
const AVAILABILITY = ['Setup (before)', 'During the event', 'Cleanup (after)', 'Whole event']
const ROLES = ['Check-in desk', 'Setup and cleanup', 'Food and drinks', 'Greeter', 'Anywhere needed']

// "Volunteer for this event" on the event page: a short form, then the status of your sign-up.
export function VolunteerSignupForm({ eventId }: { eventId: string }) {
 const load = useCallback(async () => (await getMyVolunteerSignups()).find(s => s.event_id === eventId) ?? null, [eventId])
 const { data: signup, error, reload } = useFocusResource(load, null as MyVolunteerSignup | null)
 const [form, setForm] = useState<VolunteerAnswers | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const locked = useRef(false)
 async function run(action: () => Promise<string>) {
  if (locked.current) return
  locked.current = true; setBusy(true); setMessage('')
  try { setMessage(await action()); await reload() } catch (e) { setMessage(e instanceof Error ? e.message : 'Something went wrong. Try again.') } finally { locked.current = false; setBusy(false) }
 }
 const active = signup && signup.status !== 'cancelled'

 return <View style={[styles.card, { gap: 10 }]}>
  <Text style={styles.heading}>Volunteer at this event</Text>
  {!!(error || message) && <Text accessibilityRole="alert" style={styles.alert}>{error || message}</Text>}
  {active && !form && <>
   <Text style={styles.text}>{signup.status === 'confirmed' ? 'You’re on the team for this event. Your role is in the Team tab.' : 'Thanks! The team will confirm your spot.'}</Text>
   <View style={{ flexDirection: 'row', gap: 20 }}>
    {signup.status === 'requested' && <Link label="Edit answers" disabled={busy} onPress={() => setForm({ availability: signup.availability, preferred_role: signup.preferred_role, notes: signup.notes })} />}
    <Link label="Cancel sign-up" color={brand.danger} disabled={busy} onPress={() => void run(async () => { await cancelMyVolunteerSignup(eventId); return 'Your volunteer sign-up is cancelled.' })} />
   </View>
  </>}
  {!active && !form && <>
   <Text style={styles.text}>Help make this event happen. Pick when you can help and what you’d like to do.</Text>
   <Button label="Volunteer for this event" disabled={busy} onPress={() => setForm({ availability: '', preferred_role: '', notes: '' })} />
  </>}
  {form && <>
   <Text style={[styles.text, { color: brand.ink, fontFamily: fonts.label }]}>When can you help?</Text>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AVAILABILITY.map(a => <Chip key={a} label={a} selected={form.availability === a} onPress={() => setForm({ ...form, availability: a })} />)}</View>
   <Text style={[styles.text, { color: brand.ink, fontFamily: fonts.label }]}>What would you like to do?</Text>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ROLES.map(r => <Chip key={r} label={r} selected={form.preferred_role === r} onPress={() => setForm({ ...form, preferred_role: r })} />)}</View>
   <TextInput accessibilityLabel="Notes for the team" placeholder="Anything else the team should know? (optional)" value={form.notes} onChangeText={notes => setForm({ ...form, notes })} style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} multiline maxLength={1000} />
   <Button label={busy ? 'Sending…' : 'Send'} disabled={busy || !form.availability || !form.preferred_role} onPress={() => void run(async () => { await signUpToVolunteer(eventId, form); setForm(null); return 'Thanks! The team will confirm your spot.' })} />
   <TouchableOpacity accessibilityRole="button" onPress={() => setForm(null)}><Text style={{ color: brand.inkMuted, fontFamily: fonts.label, textAlign: 'center' }}>Cancel</Text></TouchableOpacity>
  </>}
 </View>
}
