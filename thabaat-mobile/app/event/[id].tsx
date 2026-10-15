import { useFocusResource } from '@/hooks/useFocusResource'
import { brand, fonts, shadow } from '@/constants/brand'
import { Alert } from '@/lib/alert'
import { View, Text, Image, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useCallback, useState } from 'react'
import { getEventById } from '@/services/eventService'
import { getMyEventRegistration } from '@/services/registrationService'
import { useAuth } from '@/hooks/useAuth'
import { paidTestEventId } from '@/lib/paid-event-test'
import { EventStructuredDetails } from '@/components/EventStructuredDetails'
import type { EventDetails } from '@/lib/event-details'
import { EVENT_TZ, formatEventTime } from '@/lib/event-time'
import { Event } from '@/types'
import CalendarActions from '@/components/events/CalendarActions'
import EventShareActions from '@/components/events/EventShareActions'
import { PressableScale } from '@/components/PressableScale'
import { ManagementButton as Button } from '@/components/ManagementUI'
import { isDemoMode } from '@/lib/demo-mode'

type Registration = { id: string; status: string } | null

// Event page: what it is, when and where, and one pinned Register button. Extras open on demand.
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [extra, setExtra] = useState<'calendar' | 'share' | null>(null)
  const [now] = useState(Date.now)
  const load = useCallback(async (): Promise<[Event | null, Registration]> => {
    if (!id) throw new Error('Missing event ID.')
    return Promise.all([getEventById(id), user ? getMyEventRegistration(user.id, id) : Promise.resolve(null)])
  }, [id, user])
  const { data: [event, registration], loading, error, reload } = useFocusResource(load, [null, null] as [Event | null, Registration])

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={brand.primary} /></View>
  if (error) return <View style={[styles.centered, { padding: 24, gap: 16 }]}><Text style={styles.errorText} accessibilityRole="alert">{error}</Text><Button label="Try again" onPress={() => void reload()} /></View>
  if (!event) return <View style={styles.centered}><Text style={styles.errorText}>Event not found</Text></View>

  const tz = (event as Event & EventDetails).timezone || EVENT_TZ
  const passed = new Date(event.event_date).getTime() < now
  const handleRegister = () => {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to register for events'); return }
    router.push(`/registration/${id}`)
  }
  const toggle = (which: 'calendar' | 'share') => setExtra(extra === which ? null : which)
  const quiet = (label: string, onPress: () => void, selected = false) => <PressableScale key={label} accessibilityRole="button" accessibilityState={{ expanded: selected }} onPress={onPress} hitSlop={6}
    style={[styles.quiet, selected && styles.quietSelected]}><Text style={styles.quietText}>{label}</Text></PressableScale>

  return <View style={styles.container}>
    <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
      <View>
        {event.image_url
          ? <Image source={{ uri: event.image_url }} style={styles.image} resizeMode="cover" />
          : <View style={styles.banner}><Text style={styles.bannerText}>THABAAT</Text></View>}
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeMonth}>{formatEventTime(event.event_date, tz, { month: 'short' }).toUpperCase()}</Text>
          <Text style={styles.dateBadgeDay}>{formatEventTime(event.event_date, tz, { day: 'numeric' })}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.when}>{formatEventTime(event.event_date, tz, { weekday: 'long', month: 'long', day: 'numeric' })} · {formatEventTime(event.event_date, tz, { hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.where}>{event.location}</Text>

        <View style={styles.quietRow}>
          {quiet('Add to calendar', () => toggle('calendar'), extra === 'calendar')}
          {!isDemoMode && quiet('Share', () => toggle('share'), extra === 'share')}
          {!isDemoMode && quiet('Waitlist', () => router.push(`/waitlist/${id}`))}
        </View>
        {extra === 'calendar' && <CalendarActions event={event} showHeading={false} />}
        {extra === 'share' && <EventShareActions eventId={event.id} />}

        {!!event.description && <><Text style={styles.sectionTitle}>About this event</Text><Text style={styles.description}>{event.description}</Text></>}
        <EventStructuredDetails event={event as Event & EventDetails} />
        {registration && id === paidTestEventId && <Button label="Open paid event access" onPress={() => router.push(`/event/access/${id}`)} />}
      </View>
    </ScrollView>

    <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
      {registration
        ? <PressableScale accessibilityRole="button" style={[styles.cta, styles.ctaRegistered]} disabled={registration.status !== 'confirmed'} onPress={() => router.push(`/ticket/${registration.id}`)}>
            <Text style={[styles.ctaText, { color: brand.primaryDark }]}>{registration.status === 'confirmed' ? 'You’re registered · Open ticket' : 'You’re registered'}</Text>
          </PressableScale>
        : <PressableScale accessibilityRole="button" style={styles.cta} disabled={passed} onPress={handleRegister}>
            <Text style={styles.ctaText}>{passed ? 'This event has passed' : 'Register'}</Text>
          </PressableScale>}
    </View>
  </View>
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.page },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: brand.page },
  image: { width: '100%', height: 220 },
  banner: { width: '100%', height: 150, backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center' },
  bannerText: { color: brand.teal, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 7 },
  dateBadge: { position: 'absolute', left: 20, bottom: -24, backgroundColor: brand.gold, borderRadius: brand.radiusSmall, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center', ...shadow },
  dateBadgeMonth: { color: brand.navy, fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1 },
  dateBadgeDay: { color: brand.navy, fontFamily: fonts.headingHeavy, fontSize: 22, lineHeight: 26 },
  content: { padding: 20, paddingTop: 38, gap: 4 },
  title: { fontSize: 26, fontFamily: fonts.headingHeavy, color: brand.ink, marginBottom: 6 },
  when: { fontSize: 15, color: brand.primary, fontFamily: fonts.label },
  where: { fontSize: 15, color: brand.inkMuted },
  quietRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 6 },
  quiet: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: brand.line, backgroundColor: brand.card },
  quietSelected: { borderColor: brand.primary, backgroundColor: brand.primarySoft },
  quietText: { color: brand.ink, fontFamily: fonts.label, fontSize: 14 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.heading, color: brand.ink, marginTop: 18, marginBottom: 6 },
  description: { fontSize: 15, color: brand.inkMuted, lineHeight: 22 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.card, borderTopWidth: StyleSheet.hairlineWidth, borderColor: brand.line },
  cta: { height: 52, borderRadius: 999, backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center' },
  ctaRegistered: { backgroundColor: brand.primarySoft },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.heading },
  errorText: { color: brand.ink, fontSize: 16, textAlign: 'center' },
})
