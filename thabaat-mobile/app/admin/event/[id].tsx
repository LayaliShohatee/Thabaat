import { useCallback, useRef, useState } from 'react'
import { ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getManagementEvents, saveEvent, setEventSocialQuestion } from '@/services/managementService'
import { uploadEventFlyer } from '@/services/eventImageService'
import { DateTimeField } from '@/components/DateTimeField'
import { EVENT_TYPES, OPTIONAL_FIELDS, blankEventForm, formFromEvent, missingRequired, toSaveInput, withEventType, type EventForm } from '@/lib/event-form'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'

// Says whether attendees will see a field on the event page.
function Visibility({ shown }: { shown: boolean }) {
 return <Text style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 11, fontFamily: fonts.label, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  color: shown ? brand.primaryDark : brand.zaytDeep, backgroundColor: shown ? brand.primarySoft : brand.zaytSoft }}>{shown ? 'Shown on event page' : 'Only staff see this'}</Text>
}

function Field({ label, shown, children }: { label: string; shown: boolean; children: React.ReactNode }) {
 return <View style={{ gap: 6 }}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
   <Text style={{ color: brand.ink, fontFamily: fonts.label, fontSize: 15, flexShrink: 1 }}>{label}</Text><Visibility shown={shown} />
  </View>
  {children}
 </View>
}

// Create or edit an event on its own page: a highlighted box of required items, then optional extras.
export default function EventEditor() {
 const { id } = useLocalSearchParams<{ id: string }>()
 const isNew = !id || id === 'new'
 const [form, setForm] = useState<EventForm | null>(isNew ? blankEventForm() : null)
 const load = useCallback(async () => {
  if (isNew) return null
  const event = (await getManagementEvents()).find(e => e.id === id)
  if (!event) throw new Error('This event could not be found or was archived.')
  setForm(current => current ?? formFromEvent(event))
  return event
 }, [id, isNew])
 const { loading, error } = useFocusResource(load, null)
 const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const locked = useRef(false)
 const update = (patch: Partial<EventForm>) => setForm(current => current && { ...current, ...patch })

 async function run(action: () => Promise<void>) {
  if (locked.current) return
  locked.current = true; setBusy(true); setMessage('')
  try { await action() } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save') } finally { locked.current = false; setBusy(false) }
 }
 const save = () => void run(async () => {
  const input = toSaveInput(form!)
  const savedId = await saveEvent(input)
  const target = (typeof savedId === 'string' && savedId) || form!.id
  if (target) await setEventSocialQuestion(target, form!.ask_social_time)
  if (target) router.replace(`/admin/manage/${target}`); else router.back()
 })
 const uploadFlyer = () => void run(async () => { const url = await uploadEventFlyer(); if (url) { update({ image_url: url }); setMessage('Flyer added. Save the event to keep it.') } })

 const title = isNew ? 'New event' : 'Edit event'
 if (!form) return <><Stack.Screen options={{ title }} /><View style={[styles.page, styles.content]}>{error ? <Text accessibilityRole="alert" style={styles.alert}>{error}</Text> : <Text style={styles.text}>{loading ? 'Loading event…' : ''}</Text>}</View></>
 const missing = missingRequired(form)

 return <><Stack.Screen options={{ title }} />
  <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: 20 }]} keyboardShouldPersistTaps="handled">
   <View style={{ flexDirection: 'row', gap: 10 }}>
    {EVENT_TYPES.map(t => <PressableScale key={t.id} accessibilityRole="radio" accessibilityState={{ selected: form.type === t.id }} onPress={() => setForm(withEventType(form, t.id))}
     style={{ flex: 1, padding: 14, borderRadius: brand.radiusSmall, borderWidth: 2, borderColor: form.type === t.id ? brand.primary : brand.line, backgroundColor: form.type === t.id ? brand.primarySoft : brand.card }}>
     <Text style={{ fontFamily: fonts.heading, color: brand.ink, fontSize: 16 }}>{t.label}</Text><Text style={styles.text}>{t.note}</Text>
    </PressableScale>)}
   </View>

   <View style={[styles.card, { borderWidth: 2, borderColor: brand.sage, backgroundColor: brand.page, gap: 16 }]}>
    <Text style={styles.heading}>Required to create the event</Text>
    <Field label="Title" shown><TextInput accessibilityLabel="Event title" style={styles.input} value={form.title} onChangeText={title => update({ title })} placeholder="e.g. Pop-Up @ Kitab" /></Field>
    <Field label="Starts" shown><DateTimeField label="" value={form.start} onChange={start => update({ start })} /></Field>
    <Field label="Location" shown><TextInput accessibilityLabel="Event location" style={styles.input} value={form.location} onChangeText={location => update({ location })} placeholder="e.g. Kitab Cafe, Detroit" /></Field>
    <Field label="Minimum age" shown><TextInput accessibilityLabel="Minimum age" style={styles.input} value={form.age_min} onChangeText={age_min => update({ age_min: age_min.replace(/\D/g, '') })} placeholder="Blank = all ages" keyboardType="number-pad" /></Field>
    <Field label="Capacity (spots)" shown={false}><TextInput accessibilityLabel="Event capacity" style={styles.input} value={form.capacity} onChangeText={capacity => update({ capacity: capacity.replace(/\D/g, '') })} keyboardType="number-pad" /></Field>
    <Text style={styles.text}>A free General admission ticket is added automatically. Add more ticket types after saving.</Text>
   </View>

   <Text style={[styles.heading, { marginTop: 8 }]}>Optional details</Text>
   <Text style={styles.text}>Fill in what helps attendees. Leave the rest blank.</Text>
   <View style={[styles.card, { gap: 16 }]}>
    <Field label="Ends" shown><DateTimeField label="" value={form.end} onChange={end => update({ end })} optional /></Field>
    <Field label="Flyer image" shown><Button label={busy ? 'Uploading…' : form.image_url ? 'Replace flyer' : 'Upload flyer'} disabled={busy} onPress={uploadFlyer} /></Field>
    {OPTIONAL_FIELDS.map(f => <Field key={f.key} label={f.label} shown>
     <TextInput accessibilityLabel={f.label} style={[styles.input, f.multiline && { minHeight: 80, textAlignVertical: 'top' }]} value={form[f.key]} onChangeText={value => update({ [f.key]: value })} placeholder={f.hint} multiline={f.multiline} />
    </Field>)}
    <Field label="Members only" shown><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[styles.text, { flex: 1 }]}>Only verified members can register.</Text><Switch accessibilityLabel="Members only event" value={form.members_only} onValueChange={members_only => update({ members_only })} /></View></Field>
    <Field label="Social time question" shown><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[styles.text, { flex: 1 }]}>Ask “Are you attending social time (ages 23+ only)?” when people register.</Text><Switch accessibilityLabel="Ask about social time" value={form.ask_social_time} onValueChange={ask_social_time => update({ ask_social_time })} /></View></Field>
   </View>

   {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
   {missing.length > 0 && <Text style={styles.text}>Still needed: {missing.join(', ')}.</Text>}
   <Button label={busy ? 'Saving…' : isNew ? 'Create event' : 'Save changes'} disabled={busy || missing.length > 0} onPress={save} />
   <PressableScale accessibilityRole="button" disabled={busy} onPress={() => router.back()}><Text style={{ color: brand.inkMuted, fontFamily: fonts.label, textAlign: 'center', paddingVertical: 8 }}>Cancel</Text></PressableScale>
  </ScrollView></>
}
