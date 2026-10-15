import { useCallback, useState } from 'react'
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand, fonts, links, shadow } from '@/constants/brand'
import { useAuth } from '@/hooks/useAuth'
import { useEvents } from '@/hooks/useEvents'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getUserRegistrations } from '@/services/registrationService'
import EventCard from '@/components/events/EventCard'
import type { Registration } from '@/types'

// Home: a welcome, the member's next booked event, and what's coming up. Browsing and registering live in Events.
export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { events, loading, error, refetch } = useEvents()
  const loadTickets = useCallback(() => user ? getUserRegistrations(user.id) : Promise.resolve([]), [user])
  const { data: registrations, reload } = useFocusResource<Registration[]>(loadTickets, [])
  const [now] = useState(Date.now)
  const firstName = String(user?.user_metadata?.full_name || '').trim().split(/\s+/)[0]
  const next = registrations
    .filter(r => r.status === 'confirmed' && r.event?.event_date && new Date(r.event.event_date).getTime() > now - 6 * 3600000)
    .sort((a, b) => new Date(a.event!.event_date).getTime() - new Date(b.event!.event_date).getTime())[0]

  return <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 40 }}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void refetch(); void reload() }} tintColor={brand.primary} />}>
    <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
      <Text style={styles.wordmark}>THABAAT</Text>
      <Text style={styles.tagline}>HEARTS FIRM TOGETHER</Text>
      <Text style={styles.greeting}>{firstName ? `Salaam, ${firstName}` : 'Salaam'}</Text>
      <Text style={styles.heroText}>A community for young professionals in Southeast Michigan to grow socially, spiritually and professionally.</Text>
    </View>

    {next && <PressableScale accessibilityRole="button" style={styles.nextCard} onPress={() => router.push(`/ticket/${next.id}`)}>
      <Text style={styles.nextLabel}>YOUR NEXT EVENT</Text>
      <Text style={styles.nextTitle}>{next.event?.title}</Text>
      <Text style={styles.nextMeta}>{new Date(next.event!.event_date).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
      <Text style={styles.nextAction}>Open ticket →</Text>
    </PressableScale>}

    <View style={styles.quickRow}>
      {([['Events', () => router.push('/(tabs)/events')], ['FAQ', () => router.push('/faq')], ['Follow us', () => void Linking.openURL(links.social)]] as const).map(([label, onPress]) =>
        <PressableScale key={label} accessibilityRole="button" style={styles.quick} onPress={onPress}><Text style={styles.quickText}>{label}</Text></PressableScale>)}
    </View>

    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Coming up</Text>
      <PressableScale accessibilityRole="button" onPress={() => router.push('/(tabs)/events')}><Text style={styles.seeAll}>See all</Text></PressableScale>
    </View>
    {!!error && !events.length && <Text accessibilityRole="alert" style={styles.muted}>Unable to load events. Pull down to try again.</Text>}
    {!loading && !error && !events.length && <Text style={styles.muted}>No upcoming events yet. Check back soon.</Text>}
    {events.slice(0, 3).map(event => <EventCard key={event.id} event={event} />)}
  </ScrollView>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: brand.page },
  hero: { backgroundColor: brand.navy, paddingHorizontal: 24, paddingBottom: 56, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  wordmark: { color: '#FFFFFF', fontFamily: fonts.heading, fontSize: 30, letterSpacing: 8 },
  tagline: { color: brand.teal, fontFamily: fonts.label, fontSize: 11, letterSpacing: 3, marginTop: 4 },
  greeting: { color: '#FFFFFF', fontFamily: fonts.headingHeavy, fontSize: 24, marginTop: 28 },
  heroText: { color: brand.navySoft, fontSize: 15, lineHeight: 22, marginTop: 6 },
  nextCard: { marginHorizontal: 16, marginTop: -36, backgroundColor: brand.card, borderRadius: brand.radius, padding: 18, borderLeftWidth: 5, borderLeftColor: brand.gold, ...shadow },
  nextLabel: { color: brand.primary, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.5 },
  nextTitle: { color: brand.ink, fontFamily: fonts.heading, fontSize: 19, marginTop: 6 },
  nextMeta: { color: brand.inkMuted, fontSize: 14, marginTop: 4 },
  nextAction: { color: brand.primary, fontFamily: fonts.label, fontSize: 14, marginTop: 10 },
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 18 },
  quick: { flex: 1, backgroundColor: brand.card, borderRadius: brand.radiusSmall, borderWidth: 1, borderColor: brand.line, paddingVertical: 14, alignItems: 'center' },
  quickText: { color: brand.ink, fontFamily: fonts.label, fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, marginTop: 26, marginBottom: 4 },
  sectionTitle: { color: brand.ink, fontFamily: fonts.heading, fontSize: 20 },
  seeAll: { color: brand.primary, fontFamily: fonts.label, fontSize: 14 },
  muted: { color: brand.inkMuted, paddingHorizontal: 20, marginTop: 8 },
})
