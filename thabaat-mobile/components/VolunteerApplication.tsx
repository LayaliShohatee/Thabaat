import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { useAuth } from '@/hooks/useAuth'
import { getProfile } from '@/services/profileService'
import { chooseVolunteerResume, getVolunteerWork, submitVolunteerInterest, uploadVolunteerResume, type VolunteerWork } from '@/services/staffService'
import type { MediaUploadAsset } from '@/lib/media-upload'
import { ATTENDANCE_OPTIONS, CONTACT_OPTIONS, CONTRIBUTE_OPTIONS, DAY_OPTIONS, HOURS_OPTIONS, PROGRAM_OPTIONS, VOLUNTEER_INTRO, emptyVolunteerInterest, toggle, volunteerAnswers, volunteerProblem, type VolunteerInterest } from '@/lib/volunteer-form'
import { ManagementButton as Button, ManagementLink as Link, managementStyles as styles } from './ManagementUI'

// A checkbox (several answers) or radio (one answer) row, like the Google form.
function Choice({ label, selected, multiple, onPress }: { label: string; selected: boolean; multiple: boolean; onPress: () => void }) {
 return <PressableScale accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected }} accessibilityLabel={label} onPress={onPress} haptic="selection" hitSlop={4}
  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
  <View style={{ width: 22, height: 22, borderRadius: multiple ? 5 : 11, borderWidth: 1.5, borderColor: selected ? brand.primary : brand.line, backgroundColor: selected ? brand.primary : brand.card, alignItems: 'center', justifyContent: 'center' }}>
   {selected && <Text style={{ color: brand.page, fontSize: 13, fontFamily: fonts.heading }}>✓</Text>}
  </View>
  <Text style={[styles.text, { flex: 1, color: brand.ink }]}>{label}</Text>
 </PressableScale>
}

// "Volunteer with Thabaat": the client's volunteer interest form, then the application status.
export function VolunteerApplication() {
 const { user } = useAuth()
 const load = useCallback(async () => {
  const [work, profile] = await Promise.all([getVolunteerWork(), user ? getProfile(user.id).catch(() => null) : Promise.resolve(null)])
  return { work, profile }
 }, [user])
 const { data, error, reload } = useFocusResource(load, { work: { application: null, assignments: [] } as VolunteerWork, profile: null } as Awaited<ReturnType<typeof load>>)
 const { work, profile } = data
 const [form, setForm] = useState<VolunteerInterest | null>(null)
 const [resume, setResume] = useState<MediaUploadAsset | null>(null)
 const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
 const locked = useRef(false)
 const status = work.application?.status

 async function run(action: () => Promise<void>) {
  if (locked.current) return
  locked.current = true; setBusy(true); setMessage('')
  try { await action() } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed') } finally { locked.current = false; setBusy(false) }
 }
 const open = () => {
  const age = profile?.birth_year ? String(new Date().getFullYear() - profile.birth_year) : ''
  const gender = profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : ''
  setForm(emptyVolunteerInterest({ email: profile?.email ?? user?.email ?? '', name: profile?.full_name ?? '', age, gender }))
 }
 const submit = () => void run(async () => {
  if (!form) return
  const problem = volunteerProblem(form)
  if (problem) { setMessage(problem); return }
  const resumePath = resume ? await uploadVolunteerResume(resume) : null
  await submitVolunteerInterest(volunteerAnswers(form), resumePath)
  setForm(null); setResume(null); await reload()
  setMessage('JazakAllah khair! Your form was sent to the Thabaat team; they’ll reach out insha’Allah.')
 })

 const set = (patch: Partial<VolunteerInterest>) => { setMessage(''); setForm(current => current && { ...current, ...patch }) }
 const question = (label: string, required = true) => <Text style={[styles.text, { color: brand.ink, fontFamily: fonts.label, marginTop: 8 }]}>{label}{required ? ' *' : ''}</Text>
 const field = (key: keyof VolunteerInterest, label: string, extra: object = {}, required = true) => <>
  {question(label, required)}
  <TextInput accessibilityLabel={label} style={styles.input} value={form![key] as string} onChangeText={value => set({ [key]: value })} maxLength={2000} {...extra} />
 </>
 const many = (key: 'hours_per_month' | 'available_days' | 'contribute_as' | 'anchor_programs', options: string[]) =>
  <View>{options.map(o => <Choice key={o} label={o} multiple selected={form![key].includes(o)} onPress={() => set({ [key]: toggle(form![key], o) })} />)}</View>
 const one = (key: 'attendance_frequency' | 'contact_method' | 'gender', options: { value: string; label: string }[]) =>
  <View accessibilityRole="radiogroup">{options.map(o => <Choice key={o.value} label={o.label} multiple={false} selected={form![key] === o.value} onPress={() => set({ [key]: o.value } as Partial<VolunteerInterest>)} />)}</View>
 const plain = (list: string[]) => list.map(value => ({ value, label: value }))

 return <View style={styles.card}>
  <Text style={styles.heading}>Volunteer with Thabaat</Text>
  {!!error && <Text style={styles.alert}>{error}</Text>}
  {!form && <>
   <Text style={styles.text}>{status ? `Application: ${status === 'submitted' ? 'received — the team will reach out' : status}` : 'Interested in joining the team? Fill out the volunteer interest form.'}</Text>
   {status !== 'approved' && <Button label={status ? 'Update my volunteer form' : 'Fill out the volunteer form'} disabled={busy} onPress={open} />}
  </>}
  {form && <View style={{ gap: 4 }}>
   <Text style={styles.text}>{VOLUNTEER_INTRO}</Text>
   {field('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
   {field('name', 'Name', { autoCapitalize: 'words' })}
   {field('age', 'Age (23+ only)', { keyboardType: 'number-pad', maxLength: 3 })}
   {question('Gender')}{one('gender', [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }])}
   {field('phone', 'Phone number', { keyboardType: 'phone-pad' })}
   {field('city_state', 'Where are you located? (city/state)')}
   {field('profession', 'What do you do professionally?')}
   {field('experience', 'Please describe some of your past experiences (volunteering/professionally)', { multiline: true, style: [styles.input, { minHeight: 80, textAlignVertical: 'top' }] })}
   {field('why_join', 'Why do you want to join the team?', { multiline: true, style: [styles.input, { minHeight: 80, textAlignVertical: 'top' }] })}
   {question('How many hours do you anticipate to commit every month?')}{many('hours_per_month', HOURS_OPTIONS)}
   {question('How often have you attended Thabaat?')}{one('attendance_frequency', [...plain(ATTENDANCE_OPTIONS), { value: 'Other', label: 'Other:' }])}
   {form.attendance_frequency === 'Other' && <TextInput accessibilityLabel="Other: how often you have attended" style={styles.input} value={form.attendance_other} onChangeText={attendance_other => set({ attendance_other })} maxLength={200} />}
   {question('What day(s) of the week are you available for events and/or meetings?')}{many('available_days', DAY_OPTIONS)}
   {question('How would you like to contribute to Thabaat?')}{many('contribute_as', CONTRIBUTE_OPTIONS)}
   {question('If you want to be an Anchor or Lead, can you specify for which program?')}{many('anchor_programs', PROGRAM_OPTIONS)}
   {field('media_skills', 'If you’re interested in Media and/or Communications, what skills would you like to support us with?', {}, false)}
   {question('Best way to contact you?', false)}{one('contact_method', plain(CONTACT_OPTIONS))}
   {field('referred_by', 'Have you interacted with or been referred by anyone on the Thabaat team? If so, please list their name(s).', {}, false)}
   {question('Please upload your resume here (PDF).', false)}
   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    <Link label={resume ? 'Choose a different PDF' : 'Add file'} disabled={busy} onPress={() => void run(async () => { const picked = await chooseVolunteerResume(); if (picked) setResume(picked) })} />
    {resume && <Link label="Remove" color={brand.inkMuted} disabled={busy} onPress={() => setResume(null)} />}
   </View>
   {resume && <Text style={styles.text}>{resume.name}</Text>}
   <View style={{ marginTop: 12, gap: 4 }}>
    <Button label={busy ? 'Sending…' : 'Submit'} disabled={busy} onPress={submit} />
    <Link center label="Cancel" color={brand.inkMuted} disabled={busy} onPress={() => { setForm(null); setResume(null); setMessage('') }} />
   </View>
  </View>}
  {work.assignments.length > 0 && <Button label="My shifts" disabled={busy} onPress={() => router.push('/volunteer-shifts')} />}
  {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
 </View>
}
