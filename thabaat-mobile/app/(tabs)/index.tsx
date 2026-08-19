import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'

import { useEvents } from '@/hooks/useEvents'
import EventCard from '@/components/events/EventCard'

export default function HomeScreen() {
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
      </View>
    )
  }

  return (
    <FlatList
      data={events}
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
        <View style={styles.header}>
          <Text style={styles.title}>
            Discover Events
          </Text>

          <Text style={styles.subtitle}>
            Find events happening around you
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            No upcoming events
          </Text>

          <Text style={styles.emptyText}>
            Check back later for new events.
          </Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
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