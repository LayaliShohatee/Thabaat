import { useFocusResource } from '@/hooks/useFocusResource'
import { brand, fonts } from '@/constants/brand'
import { PressableScale } from '@/components/PressableScale'
import { Alert } from '@/lib/alert'
import {
  View,
  Text,
  ScrollView,
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
import { getPaymentsMode, sandboxPurchaseTicket, type PaymentsMode } from '@/services/sandboxPaymentService'

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
  const { data: paymentsMode } = useFocusResource(getPaymentsMode, 'off' as PaymentsMode)
  const sandbox = paymentsMode === 'sandbox'
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
    if (selectedTicket.price > 0 && sandbox) {
      setSubmitting(true)
      try {
        const result = await sandboxPurchaseTicket(selectedTicket.id, code)
        router.replace(`/registration/confirmation?eventTitle=${encodeURIComponent(event.title)}&notificationSent=false&freeRegistration=false&registrationId=${encodeURIComponent(result.registration_id)}&eventId=${encodeURIComponent(event.id)}&testCharge=${result.charged_cents}`)
      } catch (error: any) { Alert.alert('Payment failed', error.message) }
      finally { setSubmitting(false) }
      return
    }
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
        <ActivityIndicator size="large" color={brand.primary} />
      </View>
    )
  }

  if (error) return <View style={styles.centered}><Text style={styles.errorText} accessibilityRole="alert">{error}</Text><PressableScale accessibilityRole="button" style={[styles.confirmButton, { alignSelf: 'stretch', marginHorizontal: 24, marginTop: 16 }]} onPress={reload}><Text style={styles.confirmButtonText}>Try again</Text></PressableScale></View>

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    )
  }

  // Same rule as before, named so the button can look disabled when it is.
  const confirmDisabled = submitting || !selectedTicket || (selectedTicket.price > 0 && !sandbox && !(isPaymentCheckEnabled && selectedTicket.id === paidTestTicketId))

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>REGISTERING FOR</Text>
        <Text style={styles.eventName}>{event.title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose a ticket</Text>
        {ticketTypes.length === 0 ? (
          <Text style={styles.noTickets}>No tickets available</Text>
        ) : (
          ticketTypes.map((ticket) => (
            <PressableScale
              key={ticket.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedTicket?.id === ticket.id }}
              style={[
                styles.ticketOption,
                selectedTicket?.id === ticket.id && styles.ticketOptionSelected
              ]}
              onPress={() => setSelectedTicketId(ticket.id)}
            >
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketName}>{ticket.name}</Text>
                <View style={[styles.radio, selectedTicket?.id === ticket.id && styles.radioSelected]}>{selectedTicket?.id === ticket.id && <Text style={styles.radioCheck}>✓</Text>}</View>
              </View>
              {!!ticket.category && ticket.category !== 'general' && <Text style={styles.ticketDescription}>{categoryLabel(ticket.category)}{ticket.sale_ends_at ? ` · on sale until ${new Date(ticket.sale_ends_at).toLocaleString()}` : ''}</Text>}
              <Text style={styles.ticketPrice}>
                {ticket.price === 0 ? 'Free' : `$${ticket.price}`}
              </Text>
              {ticket.description && (
                <Text style={styles.ticketDescription}>{ticket.description}</Text>
              )}
            </PressableScale>
          ))
        )}
      </View>

      {selectedTicket && (
        <View style={styles.summary}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryText}>Event: {event.title}</Text>
          <Text style={styles.summaryText}>Ticket: {selectedTicket.name}</Text>
          <Text style={styles.summaryText}>
            Price: {selectedTicket.price === 0 ? 'Free' : `$${selectedTicket.price}`}
          </Text>
          {selectedTicket.price > 0 && (
            <>
              <TextInput accessibilityLabel="Discount code" style={styles.codeInput} value={code} onChangeText={value => { setCode(value.toUpperCase()); setQuote(null) }} placeholder="Discount code (optional)" placeholderTextColor="#888" autoCapitalize="characters" />
              <PressableScale accessibilityRole="button" style={styles.codeButton} onPress={() => void applyQuote()} disabled={quoting}>
                <Text style={styles.codeButtonText}>{quoting ? 'Checking…' : 'Check my price'}</Text>
              </PressableScale>
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
        <PressableScale
          accessibilityRole="button"
          style={[styles.confirmButton, confirmDisabled && styles.confirmButtonDisabled]}
          onPress={handleConfirmRegistration}
          disabled={confirmDisabled}
        >
          <Text style={[styles.confirmButtonText, confirmDisabled && { color: brand.primaryDark }]}>
            {submitting ? 'Confirming...' : selectedTicket && selectedTicket.price > 0 && sandbox ? `Pay ${quote ? money(quote.final_cents) : `$${selectedTicket.price}`} (test payment)` : selectedTicket?.id === paidTestTicketId && isPaymentCheckEnabled ? 'Continue to $1 paid test' : selectedTicket && selectedTicket.price > 0 ? 'Paid checkout not available' : 'Confirm Registration'}
          </Text>
        </PressableScale>

        <PressableScale
          accessibilityRole="button"
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </PressableScale>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.page },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: brand.page },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 },
  title: { fontSize: 11, fontFamily: fonts.label, letterSpacing: 1.5, color: brand.primary, marginBottom: 6 },
  eventName: { fontSize: 24, fontFamily: fonts.headingHeavy, letterSpacing: -0.4, color: brand.ink },
  section: { padding: 20, gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: fonts.heading, color: brand.ink, marginBottom: 2 },
  ticketOption: { borderWidth: 1.5, borderColor: brand.line, borderRadius: brand.radiusSmall, padding: 16, backgroundColor: brand.card },
  ticketOptionSelected: { borderColor: brand.primary, backgroundColor: brand.primarySoft },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  ticketName: { fontSize: 16, fontFamily: fonts.heading, color: brand.ink, flexShrink: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: brand.line, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.card },
  radioSelected: { borderColor: brand.primary, backgroundColor: brand.primary },
  radioCheck: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.heading },
  ticketPrice: { fontSize: 15, fontFamily: fonts.label, color: brand.primary, marginTop: 4 },
  ticketDescription: { fontSize: 13, color: brand.inkMuted, marginTop: 4, lineHeight: 18 },
  noTickets: { color: brand.inkMuted, fontSize: 15 },
  summary: { marginHorizontal: 20, padding: 16, backgroundColor: brand.card, borderRadius: brand.radius, borderWidth: 1, borderColor: brand.line, gap: 2 },
  summaryText: { color: brand.inkMuted, fontSize: 15, marginBottom: 4 },
  codeInput: { borderWidth: 1, borderColor: brand.line, borderRadius: brand.radiusSmall, color: brand.ink, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, marginBottom: 8, fontSize: 16 },
  codeButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: brand.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 8 },
  codeButtonText: { color: brand.primary, fontFamily: fonts.label },
  footer: { padding: 20, paddingBottom: 40, gap: 4 },
  confirmButton: { backgroundColor: brand.primary, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  confirmButtonDisabled: { backgroundColor: brand.primarySoft },
  confirmButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.heading },
  cancelButton: { paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { color: brand.inkMuted, fontSize: 15, fontFamily: fonts.label },
  errorText: { color: brand.ink, fontSize: 16, textAlign: 'center', paddingHorizontal: 24 },
})
