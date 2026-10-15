import { useRef, useState } from 'react'
import { Linking, Platform, StyleSheet, Text, View } from 'react-native'
import { brand, fonts } from '@/constants/brand'
import { PressableScale } from '@/components/PressableScale'
import { calendarProviderUrl, type CalendarEvent } from '@/lib/event-calendar'
import { openDeviceCalendar } from '@/services/eventCalendarService'

// showHeading is off on the event page, where the "Add to calendar" pill already names the panel.
export default function CalendarActions({ event, showHeading = true }: { event: CalendarEvent; showHeading?: boolean }) {
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
    {showHeading && <Text style={styles.heading}>Add to calendar</Text>}
    <Text style={styles.note}>Review the details before saving.{event.end_at || event.end_date ? '' : ' The end time is set to one hour.'}</Text>
    {([['device', Platform.OS === 'web' ? 'Apple Calendar / calendar file' : 'Device Calendar'], ['google', 'Google Calendar'], ['outlook', 'Outlook']] as const).map(([provider, label]) =>
      <PressableScale key={provider} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} style={styles.row} onPress={() => run(provider)}><Text style={styles.label}>{label}</Text><Text style={styles.chevron}>›</Text></PressableScale>)}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
  </View>
}
const styles = StyleSheet.create({ container: { marginVertical: 8, backgroundColor: brand.card, paddingHorizontal: 16, paddingVertical: 10, borderRadius: brand.radius, borderWidth: 1, borderColor: brand.line }, heading: { color: brand.ink, fontFamily: fonts.heading, fontSize: 16, paddingTop: 6 }, note: { color: brand.inkMuted, lineHeight: 21, paddingVertical: 4 }, row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderColor: brand.line }, label: { color: brand.ink, fontFamily: fonts.label, fontSize: 15 }, chevron: { color: brand.inkMuted, fontSize: 16 } })
