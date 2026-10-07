import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
        <ActivityIndicator size="large" color="#fff" />
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
          tintColor="#fff"
        />
      }
      ListHeaderComponent={
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.title}>
            Discover Events
          </Text>

          <Text style={styles.subtitle}>
            Find events happening around you
          </Text>
          <TextInput accessibilityLabel="Search events" placeholder="Search title, location or speaker" placeholderTextColor="#aaa" style={{ color: '#fff', borderColor: '#555', borderWidth: 1, padding: 12, marginTop: 16, borderRadius: 8 }} value={search} onChangeText={setSearch} />
          <Text style={styles.filterLabel}>When</Text>
          <View style={styles.filters}>
            {([['all', 'All upcoming'], ['week', 'Next 7 days'], ['month', 'Next month']] as const).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: window === value }} style={[styles.filter, window === value && styles.selectedFilter]} onPress={() => setWindow(value)}><Text style={styles.filterText}>{label}</Text></TouchableOpacity>)}
          </View>
          <Text style={styles.filterLabel}>Venue</Text>
          <View style={styles.filters}>
            {['', ...Array.from(new Set(events.map(event => event.location).filter(Boolean))).sort()].map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: location === value }} style={[styles.filter, location === value && styles.selectedFilter]} onPress={() => setLocation(value)}><Text style={styles.filterText}>{value || 'All venues'}</Text></TouchableOpacity>)}
          </View>
          {Boolean(search || window !== 'all' || location) && <TouchableOpacity accessibilityRole="button" onPress={() => { setSearch(''); setWindow('all'); setLocation('') }}><Text style={styles.filterLabel}>Clear filters</Text></TouchableOpacity>}
          {Boolean(error) && <Text accessibilityRole="alert" style={styles.errorText}>Refresh failed: {error}</Text>}

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
  filterLabel: { color: '#ccc', marginTop: 14, marginBottom: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderWidth: 1, borderColor: '#555', padding: 10, borderRadius: 8 },
  selectedFilter: { backgroundColor: '#14532d', borderColor: '#4ade80' },
  filterText: { color: '#fff' },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  list: {
    paddingBottom: 40,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 12,
  },

  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },

  subtitle: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 4,
  },

  centered: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  loadingText: {
    color: '#aaa',
    marginTop: 12,
  },

  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  errorText: {
    color: '#aaa',
    textAlign: 'center',
  },

  empty: {
    alignItems: 'center',
    padding: 40,
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  emptyText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
  },
})
