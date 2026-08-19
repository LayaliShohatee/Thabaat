import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { getUserRegistrations } from '@/services/registrationService'
import { useAuth } from '@/hooks/useAuth'
import { Registration } from '@/types'

export default function MyEventsScreen() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    getUserRegistrations(user.id)
      .then(setRegistrations)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  return (
    <FlatList
      data={registrations}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Text style={styles.header}>My Events</Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No registered events yet</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.browseButtonText}>Browse Events</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/event/${item.event_id}`)}
        >
          <View style={styles.cardContent}>
            <Text style={styles.eventTitle}>
              {item.event?.title ?? 'Event'}
            </Text>
            {item.event?.date && (
              <Text style={styles.eventDate}>
                {new Date(item.event.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            )}
            <Text style={styles.ticketType}>
              {item.ticket_type?.name ?? 'Ticket'}
            </Text>
            <View style={[
              styles.statusBadge,
              item.status === 'confirmed' && styles.statusConfirmed
            ]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: '#000',
    flexGrow: 1,
    paddingBottom: 40
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    padding: 20,
    paddingTop: 40
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 20
  },
  browseButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  browseButtonText: {
    color: '#000',
    fontWeight: 'bold'
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden'
  },
  cardContent: {
    padding: 16
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  eventDate: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4
  },
  ticketType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#333'
  },
  statusConfirmed: {
    backgroundColor: '#14532d'
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize'
  }
})