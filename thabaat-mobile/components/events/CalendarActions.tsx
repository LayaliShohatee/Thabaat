import { useRef, useState } from 'react'
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { calendarProviderUrl, type CalendarEvent } from '@/lib/event-calendar'
import { openDeviceCalendar } from '@/services/eventCalendarService'
import { brand } from '@/constants/brand'

export default function CalendarActions({ event }: { event: CalendarEvent }) {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const run = async (provider: 'device' | 'google' | 'outlook') => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setMessage('')
    try {
      if (provider === 'device') setMessage(await openDeviceCalendar(event))
      else {
        await Linking.openURL(calendarProviderUrl(event, provider))
        setMessage(`${provider === 'google' ? 'Google Calendar' : 'Outlook'} opened. Review the details and confirm Save there.`)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Calendar could not open. Please try again.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <View style={styles.container}>
    <Text style={styles.heading}>Add to calendar</Text>
    <Text style={styles.note}>Review before saving. {event.end_at || event.end_date ? '' : 'The end time is provisional (one hour).'}</Text>
    {([['device', Platform.OS === 'web' ? 'Apple Calendar / calendar file' : 'Device Calendar'], ['google', 'Google Calendar'], ['outlook', 'Outlook']] as const).map(([provider, label]) =>
      <TouchableOpacity key={provider} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} style={styles.button} onPress={() => run(provider)}><Text style={styles.label}>{label}</Text></TouchableOpacity>)}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
  </View>
}
const styles = StyleSheet.create({ container: { marginBottom: 20, gap: 12, backgroundColor: brand.card, padding: 18, borderRadius: 14 }, heading: { color: brand.ink, fontSize: 18, fontWeight: '600' }, note: { color: brand.inkMuted, lineHeight: 23 }, button: { backgroundColor: brand.primary, borderRadius: 9, padding: 15 }, label: { color: brand.page, textAlign: 'center', fontWeight: '600' } })
