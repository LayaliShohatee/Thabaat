import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { isPaymentCheckEnabled, paymentCheck, isVerifiedPayment, type PaymentAttempt } from '@/lib/payment-check'
import { openPaymentCheck } from '@/services/paymentCheckService'
import { beginPaymentAttempt, getPaymentAttempt } from '@/services/paymentStatusService'

export default function PaymentCheckScreen() {
  const { user } = useAuth()
  const opening = useRef(false)
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null)
  const [checking, setChecking] = useState(false)
  const request = useRef(0)
  const refresh = useCallback(async () => {
    if (!user || !isPaymentCheckEnabled) return
    const current = ++request.current
    setChecking(true)
    try {
      const next = await getPaymentAttempt()
      if (current === request.current) { setAttempt(next); setError('') }
    } catch (err) {
      if (current === request.current) setError(err instanceof Error ? err.message : 'Unable to check payment status.')
    } finally { if (current === request.current) setChecking(false) }
  }, [user])
  useFocusEffect(useCallback(() => {
    void refresh()
    let checks = 0
    const timer = setInterval(() => { if (++checks <= 4) void refresh(); else clearInterval(timer) }, 15000)
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => { request.current++; clearInterval(timer); subscription.remove() }
  }, [refresh]))
  const finished = !!attempt && attempt.status !== 'pending'

  async function checkout() {
    if (!user || !isPaymentCheckEnabled || opening.current || finished) return
    opening.current = true
    setBusy(true)
    setError('')
    try {
      const current = await beginPaymentAttempt()
      setAttempt(current)
      if (current.status !== 'pending') return
      await openPaymentCheck()
      setOpened(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open CharityStack. Check your connection and try again.')
    } finally {
      opening.current = false
      setBusy(false)
    }
  }

  if (!isPaymentCheckEnabled) return <View style={styles.unavailable}>
    <Text style={styles.title}>Payment check unavailable</Text>
    <Text style={styles.body}>This internal checkout is not enabled in this build.</Text>
  </View>

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>INTERNAL PAYMENT CHECK</Text>
    <Text style={styles.title}>Try CharityStack checkout</Text>
    <Text style={styles.body}>Open the team’s separate payment-check form from Thabaat.</Text>

    <View style={styles.card}>
      <Text style={styles.label}>Internal payment check</Text>
      <Text style={styles.price}>{paymentCheck.priceLabel}</Text>
      <Text style={styles.body}>This is a real payment, not a simulation. Review the final total and any fees in CharityStack before paying.</Text>
      <Text style={styles.body}>This test does not include admission to an event. There is one test ticket available; the form may show sold out after it is used.</Text>
    </View>

    <Text style={styles.body}>Enter payment details only in CharityStack. When finished, close checkout to return to Thabaat.</Text>
    <Text style={styles.note}>Payment confirmation is not connected to this app yet. Paying or closing checkout will not add a ticket to My Events. Check your CharityStack receipt and the team’s payment dashboard to verify the result.</Text>

    {(opened || attempt) && <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.label}>{isVerifiedPayment(attempt) ? 'Payment confirmed' : attempt?.status === 'refunded' ? 'Payment refunded' : attempt?.status === 'failed' ? 'Payment failed' : 'Waiting for payment verification'}</Text>
      <Text style={styles.body}>{isVerifiedPayment(attempt) ? 'Your payment has been verified by the server. This internal check does not grant membership or event admission.' : 'Check your receipt before paying again. Returning from checkout does not confirm a charge.'}</Text>
      {attempt && <Text selectable style={styles.note}>App checkout reference: {attempt.id}</Text>}
      <TouchableOpacity accessibilityRole="button" disabled={checking} onPress={() => void refresh()}><Text style={styles.backText}>{checking ? 'Checking…' : 'Check payment status'}</Text></TouchableOpacity>
    </View>}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || !user || finished, busy }}
      style={[styles.button, (busy || !user || finished) && styles.disabled]}
      disabled={busy || !user || finished}
      onPress={checkout}
    >
      {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{finished ? 'Checkout finished' : opened || attempt ? 'Reopen existing checkout' : 'Open $1 CharityStack checkout'}</Text>}
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={() => router.replace('/(tabs)/profile')}>
      <Text style={styles.backText}>Back to Profile</Text>
    </TouchableOpacity>
  </ScrollView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  content: { padding: 24, paddingBottom: 48, maxWidth: 620, width: '100%', alignSelf: 'center' },
  unavailable: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center' },
  eyebrow: { color: '#a6d5cf', fontSize: 12, letterSpacing: 1, marginBottom: 10 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 12 },
  body: { color: '#ddd', fontSize: 16, lineHeight: 24, marginBottom: 12 },
  card: { backgroundColor: '#151515', borderColor: '#333', borderWidth: 1, borderRadius: 12, padding: 18, marginVertical: 12 },
  label: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 10 },
  price: { color: '#fff', fontSize: 30, fontWeight: '700', marginBottom: 12 },
  note: { color: '#bbb', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  error: { color: '#ffb4b4', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  button: { backgroundColor: '#fff', borderRadius: 8, minHeight: 52, padding: 16, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  back: { padding: 18, alignItems: 'center' },
  backText: { color: '#ccc', fontSize: 16 },
})
