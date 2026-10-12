import { useFocusResource } from '@/hooks/useFocusResource'
import { brand } from '@/constants/brand'
import { Alert } from '@/lib/alert'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useCallback, useState } from 'react'
import { getEventById } from '@/services/eventService'
import { createRegistration } from '@/services/registrationService'
import { sendRegistrationConfirmation } from '@/services/notificationService'
import { useAuth } from '@/hooks/useAuth'
import { paidTestTicketId } from '@/lib/paid-event-test'
import { isPaymentCheckEnabled } from '@/lib/payment-check'
import { TicketType } from '@/types'
import { isDemoMode } from '@/lib/demo-mode'
import { categoryLabel, ticketOnSale } from '@/lib/ticket-categories'
import { money } from '@/lib/billing'
import { quoteTicketPrice, type PriceQuote } from '@/services/refundDiscountService'

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
  const ticketTypes: TicketType[] = (event?.ticket_types ?? []).filter(ticket => ticketOnSale(ticket))
  const selectedTicket = ticketTypes.find(ticket => ticket.id === selectedTicketId) ?? ticketTypes[0] ?? null
  const [code, setCode] = useState('')
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const applyQuote = async () => {
    if (!selectedTicket || quoting) return
    setQuoting(true)
    try { setQuote(await quoteTicketPrice(selectedTicket.id, code)) }
    catch (error: any) { Alert.alert('Price check failed', error.message) }
    finally { setQuoting(false) }
  }

  const handleConfirmRegistration = async () => {
    if (submitting || !user || !event || !selectedTicket) return

    if (selectedTicket.id === paidTestTicketId && isPaymentCheckEnabled) { router.push(`/payments/event/${event.id}`); return }
    if (selectedTicket.price > 0) { Alert.alert('Payment unavailable', 'Paid ticket checkout is not connected yet.'); return }
    setSubmitting(true)

    try {
      const registration = await createRegistration(user.id, event.id, selectedTicket.id)
      const notificationSent = isDemoMode ? false : await sendRegistrationConfirmation(event.id)
      router.replace(`/registration/confirmation?eventTitle=${encodeURIComponent(event.title)}&notificationSent=${notificationSent}&freeRegistration=true&registrationId=${encodeURIComponent(registration.id)}&eventId=${encodeURIComponent(event.id)}`)
    } catch (error: any) {
      Alert.alert('Registration failed', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brand.green} />
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
              {!!ticket.category && ticket.category !== 'general' && <Text style={styles.ticketDescription}>{categoryLabel(ticket.category)}{ticket.sale_ends_at ? ` · on sale until ${new Date(ticket.sale_ends_at).toLocaleString()}` : ''}</Text>}
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
          {selectedTicket.price > 0 && (
            <>
              <TextInput accessibilityLabel="Discount code" style={styles.codeInput} value={code} onChangeText={value => { setCode(value.toUpperCase()); setQuote(null) }} placeholder="Discount code (optional)" placeholderTextColor="#888" autoCapitalize="characters" />
              <TouchableOpacity accessibilityRole="button" style={styles.codeButton} onPress={() => void applyQuote()} disabled={quoting}>
                <Text style={styles.codeButtonText}>{quoting ? 'Checking…' : 'Check my price'}</Text>
              </TouchableOpacity>
              {quote && (
                <>
                  {quote.member_discount_cents > 0 && <Text style={styles.summaryText}>Member discount ({quote.member_discount_percent}%): −{money(quote.member_discount_cents)}</Text>}
                  {quote.code_applied && <Text style={styles.summaryText}>Code {code}: −{money(quote.code_discount_cents)}</Text>}
                  {!!quote.code_error && <Text style={styles.summaryText} accessibilityRole="alert">{quote.code_error}</Text>}
                  <Text style={styles.summaryText}>Your price: {money(quote.final_cents)}</Text>
                </>
              )}
            </>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
          onPress={handleConfirmRegistration}
          disabled={submitting || !selectedTicket || (selectedTicket.price > 0 && !(isPaymentCheckEnabled && selectedTicket.id === paidTestTicketId))}
        >
          <Text style={styles.confirmButtonText}>
            {submitting ? 'Confirming...' : selectedTicket?.id === paidTestTicketId && isPaymentCheckEnabled ? 'Continue to $1 paid test' : selectedTicket && selectedTicket.price > 0 ? 'Paid checkout not available' : 'Confirm Registration'}
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
    backgroundColor: brand.page
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: brand.page
  },
  header: {
    padding: 20,
    paddingTop: 40
  },
  title: {
    fontSize: 14,
    color: brand.inkMuted,
    marginBottom: 4
  },
  eventName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: brand.ink
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: brand.ink,
    marginBottom: 12
  },
  ticketOption: {
    borderWidth: 1,
    borderColor: brand.line,
    borderRadius: 8,
    padding: 16,
    marginBottom: 10
  },
  ticketOptionSelected: {
    borderColor: brand.green,
    backgroundColor: brand.card
  },
  ticketName: {
    fontSize: 16,
    fontWeight: '600',
    color: brand.ink
  },
  ticketPrice: {
    fontSize: 15,
    color: brand.inkMuted,
    marginTop: 4
  },
  ticketDescription: {
    fontSize: 13,
    color: brand.inkMuted,
    marginTop: 4
  },
  noTickets: {
    color: brand.inkMuted,
    fontSize: 15
  },
  summary: {
    margin: 20,
    padding: 16,
    backgroundColor: brand.card,
    borderRadius: 8
  },
  summaryText: {
    color: brand.inkMuted,
    fontSize: 15,
    marginBottom: 6
  },
  codeInput: { borderWidth: 1, borderColor: brand.line, borderRadius: 10, color: brand.ink, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, marginBottom: 8 },
  codeButton: { alignSelf: 'flex-start', backgroundColor: '#1F7A5C', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  codeButtonText: { color: brand.ink, fontWeight: '600' },
  footer: {
    padding: 20,
    paddingBottom: 40
  },
  confirmButton: {
    backgroundColor: brand.green,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  confirmButtonDisabled: {
    backgroundColor: brand.greenSoft
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center'
  },
    cancelButtonText: {
    color: brand.inkMuted,
    fontSize: 16
  },
  errorText: {
    color: brand.ink,
    fontSize: 16
  }
})
