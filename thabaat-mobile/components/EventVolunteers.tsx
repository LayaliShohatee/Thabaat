import { useCallback, useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getStaffReport, saveVolunteerAssignment, type StaffReport } from '@/services/staffService'
import { exportCsvFile } from '@/lib/csv-export'
import { volunteerHoursCsv } from '@/lib/staff-reporting'
import { formatEventTime, isoToWallTime, wallTimeToIso, type WallTime } from '@/lib/event-time'
import { DateTimeField } from './DateTimeField'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'

type Draft = { userId: string; name: string; duty: string; start: WallTime | null; end: WallTime | null; hours: string }

// One event's volunteers: who is assigned, add or edit a shift, remove someone.
export function EventVolunteers({ eventId }: { eventId: string }) {
 const load = useCallback(() => getStaffReport(eventId), [eventId])
 const { data: report, loading, error, reload } = useFocusResource(load, null as StaffReport | null)
 const [draft, setDraft] = useState<Draft | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const locked = useRef(false)
 async function run(action: () => Promise<void>, success: string) {
  if (locked.current) return
  locked.current = true; setBusy(true); setMessage('')
  try { await action(); setMessage(success); await reload() } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed') } finally { locked.current = false; setBusy(false) }
 }
 function startDraft(userId: string, name: string) {
  const start = report!.event.event_date
  setDraft({ userId, name, duty: 'Welcome and check-in', start: isoToWallTime(start), end: isoToWallTime(new Date(Date.parse(start) + 2 * 3600000).toISOString()), hours: '0' })
 }
 const save = () => draft && void run(async () => {
  if (!draft.start || !draft.end) throw new Error('Choose shift start and end times.')
  await saveVolunteerAssignment({ eventId, userId: draft.userId, duty: draft.duty.trim() || 'Volunteer', start: wallTimeToIso(draft.start), end: wallTimeToIso(draft.end), active: true, hours: Number(draft.hours) || 0 })
  setDraft(null)
 }, 'Volunteer assigned.')

 if (!report) return <View style={styles.card}>{error ? <Text accessibilityRole="alert" style={styles.alert}>{error}</Text> : <Text style={styles.text}>{loading ? 'Loading volunteers…' : ''}</Text>}</View>
 const assigned = new Set(report.volunteers.filter(v => v.active).map(v => v.user_id))
 const available = (report.volunteer_candidates || []).filter(v => !assigned.has(v.user_id))

 return <View style={{ gap: 14 }}>
  {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  <View style={styles.card}>
   <Text style={styles.heading}>Assigned ({report.volunteers.filter(v => v.active).length})</Text>
   {!report.volunteers.length && <Text style={styles.text}>No volunteers assigned yet.</Text>}
   {report.volunteers.map(v => <View key={v.user_id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: brand.line, opacity: v.active ? 1 : 0.55 }}>
    <Text style={{ fontFamily: fonts.label, color: brand.ink, fontSize: 15 }}>{v.full_name}{v.active ? '' : ' · removed'}</Text>
    <Text style={styles.text}>{v.duty} · {formatEventTime(v.shift_start, undefined, { hour: 'numeric', minute: '2-digit' })}–{formatEventTime(v.shift_end, undefined, { hour: 'numeric', minute: '2-digit' })} · {v.reviewed_hours} hrs</Text>
    <View style={{ flexDirection: 'row', gap: 16 }}>
     <PressableScale accessibilityRole="button" accessibilityLabel={`Edit shift for ${v.full_name}`} disabled={busy} onPress={() => setDraft({ userId: v.user_id!, name: v.full_name || 'Volunteer', duty: v.duty, start: isoToWallTime(v.shift_start), end: isoToWallTime(v.shift_end), hours: String(v.reviewed_hours) })}><Text style={{ color: brand.primary, fontFamily: fonts.label }}>Edit</Text></PressableScale>
     {v.active && <PressableScale accessibilityRole="button" accessibilityLabel={`Remove ${v.full_name}`} disabled={busy} onPress={() => void run(() => saveVolunteerAssignment({ eventId, userId: v.user_id!, duty: v.duty, start: v.shift_start, end: v.shift_end, active: false, hours: Number(v.reviewed_hours) }), `${v.full_name} removed from this event.`)}><Text style={{ color: brand.danger, fontFamily: fonts.label }}>Remove</Text></PressableScale>}
    </View>
   </View>)}
  </View>

  {draft ? <View style={styles.card}>
   <Text style={styles.heading}>Shift for {draft.name}</Text>
   <Text style={[styles.text, { color: brand.ink }]}>Role</Text>
   <TextInput accessibilityLabel="Volunteer role" style={styles.input} value={draft.duty} onChangeText={duty => setDraft({ ...draft, duty })} placeholder="e.g. Check-in desk" />
   <DateTimeField label="Shift starts" value={draft.start} onChange={start => setDraft({ ...draft, start })} />
   <DateTimeField label="Shift ends" value={draft.end} onChange={end => setDraft({ ...draft, end })} />
   <Text style={[styles.text, { color: brand.ink }]}>Hours to credit (after the shift)</Text>
   <TextInput accessibilityLabel="Reviewed hours" style={styles.input} value={draft.hours} onChangeText={hours => setDraft({ ...draft, hours })} keyboardType="decimal-pad" />
   <Button label={busy ? 'Saving…' : 'Save shift'} disabled={busy} onPress={save} />
   <PressableScale accessibilityRole="button" onPress={() => setDraft(null)}><Text style={{ color: brand.inkMuted, fontFamily: fonts.label, textAlign: 'center' }}>Cancel</Text></PressableScale>
  </View> : <View style={styles.card}>
   <Text style={styles.heading}>Add a volunteer</Text>
   {!available.length && <Text style={styles.text}>No more approved volunteers to add. Give someone the volunteer role under Admin → Roles and access.</Text>}
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {available.map(v => <PressableScale key={v.user_id} accessibilityRole="button" accessibilityLabel={`Assign ${v.full_name}`} disabled={busy} onPress={() => startDraft(v.user_id, v.full_name)}
     style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: brand.primary }}><Text style={{ color: brand.primary, fontFamily: fonts.label }}>+ {v.full_name}</Text></PressableScale>)}
   </View>
  </View>}

  {report.volunteers.length > 0 && <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { const fresh = await getStaffReport(eventId); await exportCsvFile(volunteerHoursCsv(fresh), 'thabaat-volunteers.csv', 'Thabaat volunteer hours') }, 'Volunteer hours exported.')}>
   <Text style={{ color: brand.primary, fontFamily: fonts.label, textAlign: 'center' }}>Export volunteer hours (CSV)</Text>
  </PressableScale>}
 </View>
}
