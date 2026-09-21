import { useFocusResource } from '@/hooks/useFocusResource'
import { Alert } from '@/lib/alert'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useCallback, useState } from 'react'
import { getEventById } from '@/services/eventService'
import { createRegistration } from '@/services/registrationService'
import { sendRegistrationConfirmation } from '@/services/notificationService'
import { useAuth } from '@/hooks/useAuth'
import { TicketType } from '@/types'

export default function RegistrationScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const { user } = useAuth()
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const load = useCallback(() => {
    if (!eventId) return Promise.reject(new Error('Missing event ID.'))
    return getEventById(eventId)
  }, [eventId])
  const { data: event, loading, error, reload } = useFocusResource(load, null)
  const ticketTypes: TicketType[] = event?.ticket_types ?? []
  const selectedTicket = ticketTypes.find(ticket => ticket.id === selectedTicketId) ?? ticketTypes[0] ?? null

  const handleConfirmRegistration = async () => {
    if (submitting || !user || !event || !selectedTicket) return

    if (selectedTicket.price > 0) { Alert.alert('Payment unavailable', 'Paid ticket checkout is not connected yet.'); return }
    setSubmitting(true)

    try {
      await createRegistration(user.id, event.id, selectedTicket.id)
      const notificationSent = await sendRegistrationConfirmation(event.id)
      router.replace(`/registration/confirmation?eventTitle=${encodeURIComponent(event.title)}&notificationSent=${notificationSent}`)
    } catch (error: any) {
      Alert.alert('Registration failed', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  if (error) return <View style={styles.centered}><Text style={styles.errorText} accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.confirmButton} onPress={reload}><Text>Try Again</Text></TouchableOpacity></View>

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Register for Event</Text>
        <Text style={styles.eventName}>{event.title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Ticket Type</Text>
        {ticketTypes.length === 0 ? (
          <Text style={styles.noTickets}>No tickets available</Text>
        ) : (
          ticketTypes.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={[
                styles.ticketOption,
                selectedTicket?.id === ticket.id && styles.ticketOptionSelected
              ]}
              onPress={() => setSelectedTicketId(ticket.id)}
            >
              <Text style={styles.ticketName}>{ticket.name}</Text>
              <Text style={styles.ticketPrice}>
                {ticket.price === 0 ? 'Free' : `$${ticket.price}`}
              </Text>
              {ticket.description && (
                <Text style={styles.ticketDescription}>{ticket.description}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {selectedTicket && (
        <View style={styles.summary}>
          <Text style={styles.sectionTitle}>Registration Summary</Text>
          <Text style={styles.summaryText}>Event: {event.title}</Text>
          <Text style={styles.summaryText}>Ticket: {selectedTicket.name}</Text>
          <Text style={styles.summaryText}>
            Price: {selectedTicket.price === 0 ? 'Free' : `$${selectedTicket.price}`}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
          onPress={handleConfirmRegistration}
          disabled={submitting || !selectedTicket || selectedTicket.price > 0}
        >
          <Text style={styles.confirmButtonText}>
            {submitting ? 'Confirming...' : selectedTicket && selectedTicket.price > 0 ? 'Paid checkout not available' : 'Confirm Registration'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  header: {
    padding: 20,
    paddingTop: 40
  },
  title: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4
  },
  eventName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12
  },
  ticketOption: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10
  },
  ticketOptionSelected: {
    borderColor: '#fff',
    backgroundColor: '#111'
  },
  ticketName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },
  ticketPrice: {
    fontSize: 15,
    color: '#aaa',
    marginTop: 4
  },
  ticketDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4
  },
  noTickets: {
    color: '#aaa',
    fontSize: 15
  },
  summary: {
    margin: 20,
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 8
  },
  summaryText: {
    color: '#ccc',
    fontSize: 15,
    marginBottom: 6
  },
  footer: {
    padding: 20,
    paddingBottom: 40
  },
  confirmButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  confirmButtonDisabled: {
    backgroundColor: '#333'
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold'
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center'
  },
    cancelButtonText: {
    color: '#aaa',
    fontSize: 16
  },
  errorText: {
    color: '#fff',
    fontSize: 16
  }
})