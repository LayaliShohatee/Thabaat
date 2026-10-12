import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand } from '@/constants/brand'
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const [search, setSearch] = useState('')
  const [window, setWindow] = useState<EventWindow>('all')
  const [location, setLocation] = useState('')
  const {
    events,
    loading,
    error,
    refetch,
  } = useEvents()

  if (loading && events.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brand.green} />
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
        <TouchableOpacity accessibilityRole="button" onPress={refetch}><Text style={styles.title}>Try Again</Text></TouchableOpacity>
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
          tintColor={brand.green}
        />
      }
      ListHeaderComponent={
        <View>
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.eyebrow}>THABAAT COMMUNITY</Text>
          <Text style={styles.title}>
            Discover Events
          </Text>

          <Text style={styles.subtitle}>
            Find events happening around you
          </Text>
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
  hero: { backgroundColor: brand.green, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  eyebrow: { color: brand.gold, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  search: { color: brand.ink, backgroundColor: brand.card, paddingVertical: 13, paddingHorizontal: 16, marginTop: 18, borderRadius: 999, fontSize: 15 },
  filterLabel: { color: brand.inkMuted, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderWidth: 1, borderColor: brand.line, backgroundColor: brand.card, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  selectedFilter: { backgroundColor: brand.green, borderColor: brand.green },
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

  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: '#CFE3DA',
    fontSize: 15,
    marginTop: 4,
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
