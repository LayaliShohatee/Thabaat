import { useEffect, useState } from 'react'
import { ScrollView, Text, View, Switch, Button, StyleSheet } from 'react-native'
import { useAuth } from '@/hooks/useAuth'
import { defaultNotificationPreferences, notificationCategories, reminderCadences, togglePreference, type NotificationPreferences } from '@/lib/notification-preferences'
import { loadNotificationPreferences, saveNotificationPreferences } from '@/services/notificationPreferencesService'
import { registerForPushNotifications } from '@/lib/notifications'
const labels: Record<string, string> = { men: "Men's events", women: "Women's events", young_professionals: 'Young professionals', volunteer: 'Volunteer', conferences: 'Conferences', week: '1 week before', day: '24 hours before', morning: 'Morning of · 9am at configured venue', starting: 'Event starting' }
export default function NotificationSettingsScreen() {
 const { user } = useAuth()
 const [value, setValue] = useState(defaultNotificationPreferences)
 const [loading, setLoading] = useState(true)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 const [dirty, setDirty] = useState(false)
 async function load() {
  if (!user) return
  setLoading(true); setError('')
  try { setValue(await loadNotificationPreferences(user.id)); setDirty(false) }
  catch (e) { setError(e instanceof Error ? e.message : 'Unable to load settings.') }
  finally { setLoading(false) }
 }
 useEffect(() => {
  if (!user?.id) return
  let active = true
  loadNotificationPreferences(user.id).then(result => { if (active) { setValue(result); setLoading(false) } }).catch(e => { if (active) { setError(e instanceof Error ? e.message : 'Unable to load settings.'); setLoading(false) } })
  return () => { active = false }
 }, [user?.id])
 function change(next: NotificationPreferences) { setValue(next); setDirty(true); setMessage('') }
 async function save() {
  if (!user || busy) return
  setBusy(true); setMessage(''); setError('')
  try { setValue(await saveNotificationPreferences(user.id, value)); setDirty(false); setMessage('Settings saved. Device permission is managed separately.') }
  catch (e) { setError(e instanceof Error ? e.message : 'Unable to save settings.') }
  finally { setBusy(false) }
 }
 async function device() {
  if (!user || busy) return
  setBusy(true)
  try { setMessage(await registerForPushNotifications(user.id)) }
  catch (e) { setError(e instanceof Error ? e.message : 'Unable to enable this device.') }
  finally { setBusy(false) }
 }
 const row = (label: string, enabled: boolean, onChange: () => void, unavailable = false) => <View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Switch accessibilityLabel={label} value={enabled} disabled={unavailable || loading || busy || Boolean(error && !dirty)} onValueChange={onChange}/></View>
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <Text style={styles.title}>Notification preferences</Text>
  <Text style={styles.text}>Choose what you receive. Turning off push pauses all categories without clearing your choices. Device permission does not subscribe you automatically.</Text>
  {loading ? <Text style={styles.text}>Loading settings…</Text> : null}
  {error ? <><Text accessibilityRole="alert" style={styles.text}>{error}</Text><Button title="Retry loading settings" onPress={()=>void load()} disabled={busy}/></> : null}
  {row('Receive push notifications', value.push_enabled, ()=>change({...value,push_enabled:!value.push_enabled}))}
  {row('Registration confirmations', value.confirmations, ()=>change({...value,confirmations:!value.confirmations}))}
  {row('Membership expiration alerts', value.membership_alerts, ()=>change({...value,membership_alerts:!value.membership_alerts}))}
  {row('New member videos', value.video_alerts, ()=>change({...value,video_alerts:!value.video_alerts}))}
  <Text style={styles.heading}>Registered event reminders</Text><Text style={styles.text}>Morning reminders apply only when the organizer records a venue timezone and the event starts after 9am there.</Text>
  {reminderCadences.map(item=>row(labels[item],value.reminders.includes(item),()=>change({...value,reminders:togglePreference(value.reminders,item)})))}
  <Text style={styles.heading}>Event announcements</Text>
  {notificationCategories.map(item=>row(labels[item],value.categories.includes(item),()=>change({...value,categories:togglePreference(value.categories,item)})))}
  <Button title={busy?'Please wait…':dirty?'Save notification settings':'Settings saved'} disabled={busy || loading || !dirty} onPress={()=>void save()}/>
  <View style={{height:16}}/><Button title="Enable this device" disabled={busy} onPress={()=>void device()}/>
  {message ? <Text accessibilityRole="alert" style={styles.text}>{message}</Text> : null}
 </ScrollView>
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#101412'},content:{padding:24,gap:12},title:{fontSize:28,color:'#fff',fontWeight:'bold'},heading:{fontSize:20,color:'#fff',marginTop:16},text:{color:'#d1d8d3',lineHeight:22},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},label:{color:'#fff',flex:1}})
