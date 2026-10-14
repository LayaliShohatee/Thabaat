import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand, fonts } from '@/constants/brand'
import { useLocalSearchParams } from 'expo-router'
import MyTickets from '@/components/events/MyTickets'
import { filterEvents, EventWindow } from '@/lib/event-discovery'
import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native'

import { useEvents } from '@/hooks/useEvents'
import EventCard from '@/components/events/EventCard'

// Events: browse and register (Upcoming) or open your bookings (My tickets).
export default function EventsScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ view?: string }>()
  const [view, setView] = useState<'upcoming' | 'tickets'>(params.view === 'tickets' ? 'tickets' : 'upcoming')
  // A link like /events?view=tickets switches the view even when the tab is already open.
  const [linkedView, setLinkedView] = useState(params.view)
  if (params.view !== linkedView) { setLinkedView(params.view); if (params.view === 'tickets' || params.view === 'upcoming') setView(params.view) }
  const switcher = <View style={[styles.segment, { marginTop: insets.top + 16 }]}>
    {(['upcoming', 'tickets'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: view === value }} onPress={() => setView(value)} style={[styles.segmentItem, view === value && styles.segmentSelected]}>
      <Text style={[styles.segmentText, view === value && styles.segmentSelectedText]}>{value === 'upcoming' ? 'Upcoming' : 'My tickets'}</Text>
    </TouchableOpacity>)}
  </View>
  const [search, setSearch] = useState('')
  const [window, setWindow] = useState<EventWindow>('all')
  const [location, setLocation] = useState('')
  const {
    events,
    loading,
    error,
    refetch,
  } = useEvents()

  if (view === 'tickets') return <View style={styles.container}><View style={styles.ticketsHeader}>{switcher}</View><MyTickets /></View>

  if (loading && events.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brand.primary} />
        <Text style={styles.loadingText}>
          Loading events...
        </Text>
      </View>
    )
  }

  if (error && events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>
          Unable to load events
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>
        <TouchableOpacity accessibilityRole="button" onPress={refetch}><Text style={styles.retry}>Try again</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <FlatList
      data={filterEvents(events, { search, window, location })}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <EventCard event={item} />
      )}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refetch}
          tintColor={brand.primary}
        />
      }
      ListHeaderComponent={
        <View>
        <View style={styles.ticketsHeader}>
          {switcher}
          <TextInput accessibilityLabel="Search events" placeholder="Search title, location or speaker" placeholderTextColor={brand.inkMuted} style={styles.search} value={search} onChangeText={setSearch} />
        </View>
        <View style={styles.header}>
          <Text style={styles.filterLabel}>When</Text>
          <View style={styles.filters}>
            {([['all', 'All upcoming'], ['week', 'Next 7 days'], ['month', 'Next month']] as const).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: window === value }} style={[styles.filter, window === value && styles.selectedFilter]} onPress={() => setWindow(value)}><Text style={[styles.filterText, window === value && styles.selectedFilterText]}>{label}</Text></TouchableOpacity>)}
          </View>
          <Text style={styles.filterLabel}>Venue</Text>
          <View style={styles.filters}>
            {['', ...Array.from(new Set(events.map(event => event.location).filter(Boolean))).sort()].map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: location === value }} style={[styles.filter, location === value && styles.selectedFilter]} onPress={() => setLocation(value)}><Text style={[styles.filterText, location === value && styles.selectedFilterText]}>{value || 'All venues'}</Text></TouchableOpacity>)}
          </View>
          {Boolean(search || window !== 'all' || location) && <TouchableOpacity accessibilityRole="button" onPress={() => { setSearch(''); setWindow('all'); setLocation('') }}><Text style={styles.filterLabel}>Clear filters</Text></TouchableOpacity>}
          {Boolean(error) && <Text accessibilityRole="alert" style={styles.errorText}>Refresh failed: {error}</Text>}

        </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {search || window !== 'all' || location ? 'No matching events' : 'No upcoming events'}
          </Text>

          <Text style={styles.emptyText}>
            {search || window !== 'all' || location ? 'Change or clear your filters.' : 'Check back later for new events.'}
          </Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  ticketsHeader: { paddingHorizontal: 20, paddingBottom: 4, backgroundColor: brand.page },
  segment: { flexDirection: 'row', backgroundColor: brand.card, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: brand.line },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segmentSelected: { backgroundColor: brand.navy },
  segmentText: { color: brand.ink, fontFamily: fonts.label, fontSize: 15 },
  segmentSelectedText: { color: '#FFFFFF' },
  retry: { color: brand.primary, fontFamily: fonts.label, fontSize: 16, marginTop: 16 },
  search: { color: brand.ink, backgroundColor: brand.card, paddingVertical: 13, paddingHorizontal: 16, marginTop: 14, borderRadius: 999, fontSize: 15, borderWidth: 1, borderColor: brand.line },
  filterLabel: { color: brand.inkMuted, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderWidth: 1, borderColor: brand.line, backgroundColor: brand.card, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  selectedFilter: { backgroundColor: brand.primary, borderColor: brand.primary },
  filterText: { color: brand.ink, fontWeight: '600' },
  selectedFilterText: { color: '#FFFFFF' },
  container: {
    flex: 1,
    backgroundColor: brand.page,
  },

  list: {
    paddingBottom: 40,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },



  centered: {
    flex: 1,
    backgroundColor: brand.page,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  loadingText: {
    color: brand.inkMuted,
    marginTop: 12,
  },

  errorTitle: {
    color: brand.ink,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  errorText: {
    color: brand.danger,
    textAlign: 'center',
  },

  empty: {
    alignItems: 'center',
    padding: 40,
  },

  emptyTitle: {
    color: brand.ink,
    fontSize: 18,
    fontWeight: '600',
  },

  emptyText: {
    color: brand.inkMuted,
    fontSize: 14,
    marginTop: 8,
  },
})
