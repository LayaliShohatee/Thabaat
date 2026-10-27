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
import { completeMyProfile, reserveFreeTickets } from '@/services/registrationService'
import { getProfile } from '@/services/profileService'
import { sendRegistrationConfirmation } from '@/services/notificationService'
import { isDemoMode } from '@/lib/demo-mode'
import { useAuth } from '@/hooks/useAuth'
import { paidTestTicketId } from '@/lib/paid-event-test'
import { isPaymentCheckEnabled } from '@/lib/payment-check'
import { TicketType } from '@/types'
import { categoryLabel, ticketOnSale } from '@/lib/ticket-categories'
import { money } from '@/lib/billing'
import { quoteTicketPrice, type PriceQuote } from '@/services/refundDiscountService'
import { getPaymentsMode, sandboxPurchaseTicket, type PaymentsMode } from '@/services/sandboxPaymentService'
import { ManagementChip as Chip } from '@/components/ManagementUI'
import { AttendeeForm, attendeeStyles } from '@/components/registration/AttendeeForm'
import { GENDER_OPTIONS, HEARD_FROM_OPTIONS, MAX_TICKETS_PER_BOOKING, emptyGuest, guestProblem, parseAge, type Gender, type Guest } from '@/lib/attendee'
import { bookingLines, bookingTotal, guestSlots, ticketCount, ticketSlots, type Quantities } from '@/lib/booking'

type Step = 'tickets' | 'who' | 'guest' | 'answers'

// Booking: pick ticket quantities, say whether one is yours, add each guest, then answer the event questions once.
export default function RegistrationScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const load = useCallback(async () => {
    if (!eventId) throw new Error('Missing event ID.')
    const [event, profile] = await Promise.all([getEventById(eventId), user ? getProfile(user.id).catch(() => null) : Promise.resolve(null)])
    return { event, profile }
  }, [eventId, user])
  const { data, loading, error, reload } = useFocusResource(load, { event: null, profile: null } as Awaited<ReturnType<typeof load>>)
  const { event, profile } = data
  const ticketTypes: TicketType[] = (event?.ticket_types ?? []).filter(ticket => ticketOnSale(ticket))

  const [step, setStep] = useState<Step>('tickets')
  const [quantities, setQuantities] = useState<Quantities>({})
  const [forMe, setForMe] = useState<boolean | null>(null)
  const [myTypeId, setMyTypeId] = useState<string | null>(null)
  const [myAge, setMyAge] = useState('')
  const [myGender, setMyGender] = useState<Gender | ''>('')
  const [guests, setGuests] = useState<Guest[]>([])
  const [guestIndex, setGuestIndex] = useState(0)
  const [heardFrom, setHeardFrom] = useState('')
  const [firstEvent, setFirstEvent] = useState<boolean | null>(null)
  const [socialTime, setSocialTime] = useState<boolean | null>(null)
  const [problem, setProblem] = useState('')

  const [code, setCode] = useState('')
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const { data: paymentsMode } = useFocusResource(getPaymentsMode, 'off' as PaymentsMode)
  const sandbox = paymentsMode === 'sandbox'

  const count = ticketCount(quantities)
  const slots = ticketSlots(ticketTypes, quantities)
  const chosenTypes = ticketTypes.filter(type => (quantities[type.id] ?? 0) > 0)
  const paidTicket = count === 1 && slots[0] && slots[0].price > 0 ? slots[0] : null
  const hasPaid = slots.some(slot => slot.price > 0)
  const selfTypeId = forMe ? (myTypeId ?? (chosenTypes.length === 1 ? chosenTypes[0].id : null)) : null
  const guestTypes = guestSlots(slots, selfTypeId)
  const profileComplete = !!profile?.gender && !!profile?.birth_year

  const setQuantity = (id: string, next: number) => {
    if (next < 0 || (next > (quantities[id] ?? 0) && count >= MAX_TICKETS_PER_BOOKING)) return
    setQuantities({ ...quantities, [id]: next }); setQuote(null); setProblem('')
  }
  const go = (next: Step) => { setProblem(''); setStep(next) }

  const applyQuote = async () => {
    if (!paidTicket || quoting) return
    setQuoting(true)
    try { setQuote(await quoteTicketPrice(paidTicket.id, code)) }
    catch (error: any) { Alert.alert('Price check failed', error.message) }
    finally { setQuoting(false) }
  }

  // A single paid ticket keeps the existing checkout; group bookings are free tickets only for now.
  const continueFromTickets = async () => {
    if (!event || count === 0 || submitting) return
    if (paidTicket) {
      if (paidTicket.id === paidTestTicketId && isPaymentCheckEnabled) { router.push(`/payments/event/${event.id}`); return }
      if (!sandbox) { Alert.alert('Payment unavailable', 'Paid ticket checkout is not connected yet.'); return }
      setSubmitting(true)
      try {
        const result = await sandboxPurchaseTicket(paidTicket.id, code)
        router.replace(`/registration/confirmation?eventTitle=${encodeURIComponent(event.title)}&notificationSent=false&freeRegistration=false&registrationId=${encodeURIComponent(result.registration_id)}&eventId=${encodeURIComponent(event.id)}&testCharge=${result.charged_cents}`)
      } catch (error: any) { Alert.alert('Payment failed', error.message) }
      finally { setSubmitting(false) }
      return
    }
    if (hasPaid) { setProblem('Paid tickets can be bought one at a time for now.'); return }
    go('who')
  }

  const continueFromWho = () => {
    if (forMe === null) { setProblem('Tell us whether one of these tickets is for you.'); return }
    if (forMe && !selfTypeId) { setProblem('Choose which ticket is yours.'); return }
    if (forMe && !profileComplete && (parseAge(myAge, 13) === null || !myGender)) { setProblem('Add your age and gender to continue.'); return }
    setGuests(current => guestTypes.map((_, i) => current[i] ?? emptyGuest()))
    setGuestIndex(0)
    go(guestTypes.length ? 'guest' : 'answers')
  }

  const continueFromGuest = () => {
    const issue = guestProblem(guests[guestIndex])
    if (issue) { setProblem(issue); return }
    if (guestIndex + 1 < guestTypes.length) { setProblem(''); setGuestIndex(guestIndex + 1) } else go('answers')
  }

  const back = () => {
    setProblem('')
    if (step === 'who') setStep('tickets')
    else if (step === 'guest' && guestIndex > 0) setGuestIndex(guestIndex - 1)
    else if (step === 'guest') setStep('who')
    else if (step === 'answers' && guestTypes.length) { setGuestIndex(guestTypes.length - 1); setStep('guest') }
    else if (step === 'answers') setStep('who')
    else router.back()
  }

  const confirm = async () => {
    if (submitting || !event) return
    if (!heardFrom) { setProblem('Tell us how you heard about this event.'); return }
    if (firstEvent === null) { setProblem('Tell us whether this is your first Thabaat event.'); return }
    if (event.ask_social_time && socialTime === null) { setProblem('Tell us whether you’ll attend social time.'); return }
    setSubmitting(true); setProblem('')
    try {
      if (forMe && !profileComplete) await completeMyProfile(parseAge(myAge, 13)!, myGender as Gender)
      const result = await reserveFreeTickets(event.id, bookingLines(selfTypeId, guestTypes, guests), {
        heard_from: heardFrom, first_event: firstEvent, ...(event.ask_social_time ? { social_time: socialTime! } : {}),
      })
      const notificationSent = isDemoMode ? false : await sendRegistrationConfirmation(event.id)
      router.replace(`/registration/confirmation?eventTitle=${encodeURIComponent(event.title)}&notificationSent=${notificationSent}&freeRegistration=true&registrationId=${encodeURIComponent(result.registration_ids[0])}&eventId=${encodeURIComponent(event.id)}&tickets=${result.registration_ids.length}`)
    } catch (error: any) {
      setProblem(error.message ?? 'Registration failed. Try again.')
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

  const yesNo = (value: boolean | null, set: (v: boolean) => void) => <View style={attendeeStyles.chips} accessibilityRole="radiogroup">
    <Chip label="Yes" selected={value === true} onPress={() => { set(true); setProblem('') }} />
    <Chip label="No" selected={value === false} onPress={() => { set(false); setProblem('') }} />
  </View>

  const primary = step === 'tickets'
    ? { label: submitting ? 'Confirming…' : paidTicket ? (paidTicket.id === paidTestTicketId && isPaymentCheckEnabled ? 'Continue to $1 paid test' : sandbox ? `Pay ${quote ? money(quote.final_cents) : `$${paidTicket.price}`} (test payment)` : 'Paid checkout not available') : 'Continue', onPress: () => void continueFromTickets(), disabled: submitting || count === 0 || (!!paidTicket && !sandbox && !(isPaymentCheckEnabled && paidTicket.id === paidTestTicketId)) }
    : step === 'who' ? { label: 'Continue', onPress: continueFromWho, disabled: false }
    : step === 'guest' ? { label: 'Next', onPress: continueFromGuest, disabled: false }
    : { label: submitting ? 'Confirming…' : `Confirm ${count} ${count === 1 ? 'ticket' : 'tickets'}`, onPress: () => void confirm(), disabled: submitting }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>REGISTERING FOR</Text>
        <Text style={styles.eventName}>{event.title}</Text>
      </View>

      {step === 'tickets' && <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select tickets</Text>
        {ticketTypes.length === 0 ? <Text style={styles.noTickets}>No tickets available</Text> : ticketTypes.map(ticket => {
          const quantity = quantities[ticket.id] ?? 0
          return <View key={ticket.id} style={[styles.ticketOption, quantity > 0 && styles.ticketOptionSelected]}>
            <View style={styles.ticketHeader}>
              <View style={{ flexShrink: 1, gap: 2 }}>
                <Text style={styles.ticketName}>{ticket.name}</Text>
                <Text style={styles.ticketPrice}>{ticket.price === 0 ? 'Free' : `$${ticket.price}`}</Text>
              </View>
              <View style={styles.stepper}>
                <PressableScale accessibilityRole="button" accessibilityLabel={`Remove one ${ticket.name}`} disabled={quantity === 0} onPress={() => setQuantity(ticket.id, quantity - 1)} hitSlop={8} style={[styles.stepButton, quantity === 0 && styles.stepButtonOff]}><Text style={styles.stepText}>−</Text></PressableScale>
                <Text style={styles.stepCount} accessibilityLabel={`${quantity} ${ticket.name}`}>{quantity}</Text>
                <PressableScale accessibilityRole="button" accessibilityLabel={`Add one ${ticket.name}`} disabled={count >= MAX_TICKETS_PER_BOOKING} onPress={() => setQuantity(ticket.id, quantity + 1)} hitSlop={8} style={[styles.stepButton, count >= MAX_TICKETS_PER_BOOKING && styles.stepButtonOff]}><Text style={styles.stepText}>+</Text></PressableScale>
              </View>
            </View>
            {!!ticket.category && ticket.category !== 'general' && <Text style={styles.ticketDescription}>{categoryLabel(ticket.category)}{ticket.sale_ends_at ? ` · on sale until ${new Date(ticket.sale_ends_at).toLocaleString()}` : ''}</Text>}
            {!!ticket.description && <Text style={styles.ticketDescription}>{ticket.description}</Text>}
          </View>
        })}
        {count > 0 && <View style={styles.summary}>
          <Text style={styles.summaryText}>{count} {count === 1 ? 'ticket' : 'tickets'} · Total {bookingTotal(ticketTypes, quantities) === 0 ? 'Free' : `$${bookingTotal(ticketTypes, quantities)}`}</Text>
          {paidTicket && <>
            <TextInput accessibilityLabel="Discount code" style={styles.codeInput} value={code} onChangeText={value => { setCode(value.toUpperCase()); setQuote(null) }} placeholder="Discount code (optional)" placeholderTextColor={brand.sage} autoCapitalize="characters" />
            <PressableScale accessibilityRole="button" style={styles.codeButton} onPress={() => void applyQuote()} disabled={quoting}>
              <Text style={styles.codeButtonText}>{quoting ? 'Checking…' : 'Check my price'}</Text>
            </PressableScale>
            {quote && <>
              {quote.member_discount_cents > 0 && <Text style={styles.summaryText}>Member discount ({quote.member_discount_percent}%): −{money(quote.member_discount_cents)}</Text>}
              {quote.code_applied && <Text style={styles.summaryText}>Code {code}: −{money(quote.code_discount_cents)}</Text>}
              {!!quote.code_error && <Text style={styles.summaryText} accessibilityRole="alert">{quote.code_error}</Text>}
              <Text style={styles.summaryText}>Your price: {money(quote.final_cents)}</Text>
            </>}
          </>}
        </View>}
      </View>}

      {step === 'who' && <View style={styles.section}>
        <Text style={styles.sectionTitle}>{count === 1 ? 'Is this ticket for you?' : 'Is one of these tickets for you?'}</Text>
        <Text style={styles.ticketDescription}>We’ll use your account details for your ticket.</Text>
        {yesNo(forMe, setForMe)}
        {forMe && chosenTypes.length > 1 && <>
          <Text style={attendeeStyles.label}>Which ticket is yours?</Text>
          <View style={attendeeStyles.chips} accessibilityRole="radiogroup">{chosenTypes.map(type => <Chip key={type.id} label={type.name} selected={selfTypeId === type.id} onPress={() => setMyTypeId(type.id)} />)}</View>
        </>}
        {forMe && !profileComplete && <View style={{ gap: 12 }}>
          <Text style={styles.ticketDescription}>Add your age and gender once; they’re saved to your account.</Text>
          <View style={attendeeStyles.field}>
            <Text style={attendeeStyles.label}>Your age *</Text>
            <TextInput accessibilityLabel="Your age" style={attendeeStyles.input} value={myAge} onChangeText={setMyAge} keyboardType="number-pad" maxLength={3} />
          </View>
          <View style={attendeeStyles.field}>
            <Text style={attendeeStyles.label}>Your gender *</Text>
            <View style={attendeeStyles.chips} accessibilityRole="radiogroup">{GENDER_OPTIONS.map(option => <Chip key={option.value} label={option.label} selected={myGender === option.value} onPress={() => setMyGender(option.value)} />)}</View>
          </View>
        </View>}
      </View>}

      {step === 'guest' && guests[guestIndex] && <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attendee info: {guestIndex + 1} of {guestTypes.length}</Text>
        <Text style={styles.ticketDescription}>{guestTypes[guestIndex].name}</Text>
        <AttendeeForm guest={guests[guestIndex]} onChange={guest => { setProblem(''); setGuests(guests.map((g, i) => i === guestIndex ? guest : g)) }} />
      </View>}

      {step === 'answers' && <View style={[styles.section, { gap: 16 }]}>
        <Text style={styles.sectionTitle}>About your visit</Text>
        <View style={attendeeStyles.field}>
          <Text style={attendeeStyles.label}>How did you hear about this event? *</Text>
          <View style={attendeeStyles.chips} accessibilityRole="radiogroup">{HEARD_FROM_OPTIONS.map(option => <Chip key={option} label={option} selected={heardFrom === option} onPress={() => { setHeardFrom(option); setProblem('') }} />)}</View>
        </View>
        <View style={attendeeStyles.field}>
          <Text style={attendeeStyles.label}>Is this your first time at Thabaat? *</Text>
          {yesNo(firstEvent, setFirstEvent)}
        </View>
        {event.ask_social_time && <View style={attendeeStyles.field}>
          <Text style={attendeeStyles.label}>Are you attending social time (ages 23+ only)? *</Text>
          {yesNo(socialTime, setSocialTime)}
        </View>}
      </View>}

      <View style={styles.footer}>
        {!!problem && <Text style={styles.problem} accessibilityRole="alert">{problem}</Text>}
        <PressableScale
          accessibilityRole="button"
          style={[styles.confirmButton, primary.disabled && styles.confirmButtonDisabled]}
          onPress={primary.onPress}
          disabled={primary.disabled}
        >
          <Text style={[styles.confirmButtonText, primary.disabled && { color: brand.primaryDark }]}>{primary.label}</Text>
        </PressableScale>

        <PressableScale accessibilityRole="button" style={styles.cancelButton} onPress={back}>
          <Text style={styles.cancelButtonText}>{step === 'tickets' ? 'Cancel' : 'Back'}</Text>
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
  ticketName: { fontSize: 16, fontFamily: fonts.heading, color: brand.ink },
  ticketPrice: { fontSize: 15, fontFamily: fonts.label, color: brand.primary },
  ticketDescription: { fontSize: 13, color: brand.inkMuted, marginTop: 4, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center' },
  stepButtonOff: { backgroundColor: brand.line },
  stepText: { color: brand.page, fontSize: 18, fontFamily: fonts.heading, lineHeight: 20 },
  stepCount: { minWidth: 20, textAlign: 'center', fontSize: 16, fontFamily: fonts.heading, color: brand.ink },
  noTickets: { color: brand.inkMuted, fontSize: 15 },
  summary: { padding: 16, backgroundColor: brand.card, borderRadius: brand.radius, borderWidth: 1, borderColor: brand.line, gap: 2 },
  summaryText: { color: brand.inkMuted, fontSize: 15, marginBottom: 4 },
  codeInput: { borderWidth: 1, borderColor: brand.line, borderRadius: brand.radiusSmall, color: brand.ink, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, marginBottom: 8, fontSize: 16 },
  codeButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: brand.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 8 },
  codeButtonText: { color: brand.primary, fontFamily: fonts.label },
  footer: { padding: 20, paddingBottom: 40, gap: 4 },
  problem: { color: brand.danger, fontSize: 14, marginBottom: 8, textAlign: 'center' },
  confirmButton: { backgroundColor: brand.primary, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  confirmButtonDisabled: { backgroundColor: brand.primarySoft },
  confirmButtonText: { color: brand.page, fontSize: 16, fontFamily: fonts.heading },
  cancelButton: { paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { color: brand.inkMuted, fontSize: 15, fontFamily: fonts.label },
  errorText: { color: brand.ink, fontSize: 16, textAlign: 'center', paddingHorizontal: 24 },
})
