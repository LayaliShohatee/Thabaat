import { useCallback, useRef, useState } from 'react'
import { Switch, Text, TextInput, View } from 'react-native'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getStaffReport, saveVolunteerAssignment, type StaffReport } from '@/services/staffService'
import { cancelVolunteer, confirmVolunteerSignup, listVolunteerSignups, setVolunteerRole, type EventVolunteerSignup, type VolunteerRole } from '@/services/volunteerCheckinService'
import { exportCsvFile } from '@/lib/csv-export'
import { volunteerHoursCsv } from '@/lib/staff-reporting'
import { formatEventTime, isoToWallTime, wallTimeToIso, type WallTime } from '@/lib/event-time'
import { DateTimeField } from './DateTimeField'
import { ManagementButton as Button, ManagementChip as Chip, ManagementLink as Link, managementStyles as styles } from './ManagementUI'

type ShiftDraft = { userId: string; name: string; duty: string; start: WallTime | null; end: WallTime | null; hours: string }
// mode 'confirm' = accept a sign-up, 'edit' = change an assigned volunteer's role.
type RoleDraft = VolunteerRole & { userId: string; name: string; mode: 'confirm' | 'edit' }

// The role fields shared by confirming a sign-up, editing a role and (from Attendees) making someone a volunteer.
export function VolunteerRoleFields({ value, onChange }: { value: VolunteerRole; onChange: (v: VolunteerRole) => void }) {
 return <View style={{ gap: 8 }}>
  <TextInput accessibilityLabel="Volunteer role" style={styles.input} value={value.duty} onChangeText={duty => onChange({ ...value, duty })} placeholder="Role (e.g. Check-in desk)" />
  <TextInput accessibilityLabel="Role description" style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]} value={value.role_description} onChangeText={role_description => onChange({ ...value, role_description })} placeholder="What they’ll do (optional, shown to them in Team)" multiline maxLength={500} />
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[styles.text, { color: brand.ink }]}>Volunteer lead for this event</Text><Switch accessibilityLabel="Volunteer lead" value={value.is_lead} onValueChange={is_lead => onChange({ ...value, is_lead })} /></View>
 </View>
}

// One event's volunteers: sign-ups to confirm, the assigned team (with leads and roles), and adding approved volunteers.
export function EventVolunteers({ eventId }: { eventId: string }) {
 const load = useCallback(async () => {
  const [report, signups] = await Promise.all([getStaffReport(eventId), listVolunteerSignups(eventId).catch(() => [] as EventVolunteerSignup[])])
  return { report, signups }
 }, [eventId])
 const { data, loading, error, reload } = useFocusResource(load, null as { report: StaffReport; signups: EventVolunteerSignup[] } | null)
 const [shift, setShift] = useState<ShiftDraft | null>(null), [role, setRole] = useState<RoleDraft | null>(null)
 const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const locked = useRef(false)
 async function run(action: () => Promise<unknown>, success: string) {
  if (locked.current) return
  locked.current = true; setBusy(true); setMessage('')
  try { await action(); setMessage(success); setShift(null); setRole(null); await reload() } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed') } finally { locked.current = false; setBusy(false) }
 }
 const saveShift = () => shift && void run(async () => {
  if (!shift.start || !shift.end) throw new Error('Choose shift start and end times.')
  await saveVolunteerAssignment({ eventId, userId: shift.userId, duty: shift.duty.trim() || 'Volunteer', start: wallTimeToIso(shift.start), end: wallTimeToIso(shift.end), active: true, hours: Number(shift.hours) || 0 })
 }, 'Shift saved.')
 const saveRole = () => role && void run(() => role.mode === 'confirm' ? confirmVolunteerSignup(eventId, role.userId, role) : setVolunteerRole(eventId, role.userId, role),
  role.mode === 'confirm' ? `${role.name} is confirmed.` : 'Role saved.')

 if (!data) return <View style={styles.card}>{error ? <Text accessibilityRole="alert" style={styles.alert}>{error}</Text> : <Text style={styles.text}>{loading ? 'Loading volunteers…' : ''}</Text>}</View>
 const { report, signups } = data
 const requested = signups.filter(s => s.status === 'requested')
 const assigned = new Set(report.volunteers.filter(v => v.active).map(v => v.user_id))
 const available = (report.volunteer_candidates || []).filter(v => !assigned.has(v.user_id))
 const time = (iso: string) => formatEventTime(iso, undefined, { hour: 'numeric', minute: '2-digit' })

 // One form at a time keeps the section short.
 if (role) return <View style={styles.card}>
  <Text style={styles.heading}>{role.mode === 'confirm' ? `Confirm ${role.name}` : `${role.name}’s role`}</Text>
  {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  <VolunteerRoleFields value={role} onChange={v => setRole({ ...role, ...v })} />
  <Button label={busy ? 'Saving…' : role.mode === 'confirm' ? 'Confirm volunteer' : 'Save role'} disabled={busy || role.duty.trim().length < 3} onPress={saveRole} />
  <Link label="Cancel" color={brand.inkMuted} onPress={() => setRole(null)} />
 </View>
 if (shift) return <View style={styles.card}>
  <Text style={styles.heading}>Shift for {shift.name}</Text>
  {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  <TextInput accessibilityLabel="Volunteer role" style={styles.input} value={shift.duty} onChangeText={duty => setShift({ ...shift, duty })} placeholder="e.g. Check-in desk" />
  <DateTimeField label="Shift starts" value={shift.start} onChange={start => setShift({ ...shift, start })} />
  <DateTimeField label="Shift ends" value={shift.end} onChange={end => setShift({ ...shift, end })} />
  <Text style={[styles.text, { color: brand.ink }]}>Hours to credit (after the shift)</Text>
  <TextInput accessibilityLabel="Reviewed hours" style={styles.input} value={shift.hours} onChangeText={hours => setShift({ ...shift, hours })} keyboardType="decimal-pad" />
  <Button label={busy ? 'Saving…' : 'Save shift'} disabled={busy} onPress={saveShift} />
  <Link label="Cancel" color={brand.inkMuted} onPress={() => setShift(null)} />
 </View>

 return <View style={{ gap: 14 }}>
  {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  {requested.length > 0 && <View style={[styles.card, { borderWidth: 1, borderColor: brand.sage }]}>
   <Text style={styles.heading}>Sign-ups to review ({requested.length})</Text>
   {requested.map(s => <View key={s.user_id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderColor: brand.line }}>
    <Text style={{ fontFamily: fonts.label, color: brand.ink, fontSize: 15 }}>{s.full_name}</Text>
    <Text style={styles.text}>{[s.availability, s.preferred_role].filter(Boolean).join(' · ')}</Text>
    {!!s.notes && <Text style={styles.text}>“{s.notes}”</Text>}
    <View style={{ flexDirection: 'row', gap: 20 }}>
     <Link label="Confirm" disabled={busy} onPress={() => setRole({ mode: 'confirm', userId: s.user_id, name: s.full_name, duty: s.preferred_role, role_description: '', is_lead: false })} />
     <Link label="Decline" color={brand.danger} disabled={busy} onPress={() => void run(() => cancelVolunteer(eventId, s.user_id), `${s.full_name}’s sign-up was declined.`)} />
    </View>
   </View>)}
  </View>}

  <View style={styles.card}>
   <Text style={styles.heading}>Team ({assigned.size})</Text>
   {!report.volunteers.length && <Text style={styles.text}>No volunteers assigned yet.</Text>}
   {report.volunteers.map(v => <View key={v.user_id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderColor: brand.line, opacity: v.active ? 1 : 0.55 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
     <Text style={{ fontFamily: fonts.label, color: brand.ink, fontSize: 15 }}>{v.full_name}{v.active ? '' : ' · removed'}</Text>
     {v.is_lead && v.active && <Text style={{ fontSize: 11, fontFamily: fonts.label, color: brand.zaytDeep, backgroundColor: brand.zaytSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>Lead</Text>}
    </View>
    <Text style={styles.text}>{v.duty} · {time(v.shift_start)}–{time(v.shift_end)}{v.reviewed_hours ? ` · ${v.reviewed_hours} hrs` : ''}</Text>
    {!!v.role_description && <Text style={styles.text}>{v.role_description}</Text>}
    {v.active && <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
     <Link label="Role" disabled={busy} onPress={() => setRole({ mode: 'edit', userId: v.user_id!, name: v.full_name || 'Volunteer', duty: v.duty, role_description: v.role_description || '', is_lead: !!v.is_lead })} />
     <Link label="Shift & hours" disabled={busy} onPress={() => setShift({ userId: v.user_id!, name: v.full_name || 'Volunteer', duty: v.duty, start: isoToWallTime(v.shift_start), end: isoToWallTime(v.shift_end), hours: String(v.reviewed_hours) })} />
     <Link label="Remove" color={brand.danger} disabled={busy} onPress={() => void run(() => cancelVolunteer(eventId, v.user_id!), `${v.full_name} removed from this event.`)} />
    </View>}
   </View>)}
  </View>

  <View style={styles.card}>
   <Text style={styles.heading}>Add a volunteer</Text>
   <Text style={styles.text}>{available.length ? 'Approved volunteers:' : 'No more approved volunteers. Attendees can sign up from the event page, or make an attendee a volunteer from the Attendees section.'}</Text>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {available.map(v => <Chip key={v.user_id} label={`+ ${v.full_name}`} selected={false} disabled={busy} onPress={() => {
     const start = report.event.event_date
     setShift({ userId: v.user_id, name: v.full_name, duty: 'Welcome and check-in', start: isoToWallTime(new Date(Date.parse(start) - 3600000).toISOString()), end: isoToWallTime(new Date(Date.parse(start) + 3 * 3600000).toISOString()), hours: '0' })
    }} />)}
   </View>
  </View>

  {report.volunteers.length > 0 && <Link label="Export volunteer hours (CSV)" disabled={busy} onPress={() => void run(async () => { const fresh = await getStaffReport(eventId); await exportCsvFile(volunteerHoursCsv(fresh), 'thabaat-volunteers.csv', 'Thabaat volunteer hours') }, 'Volunteer hours exported.')} />}
 </View>
}
