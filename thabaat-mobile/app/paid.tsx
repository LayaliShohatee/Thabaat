import { router } from 'expo-router'
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useCallback } from 'react'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getPaidEventOrder } from '@/services/paidEventService'
import { paidTestEventId } from '@/lib/paid-event-test'
import { isPaymentCheckEnabled } from '@/lib/payment-check'

// Proposed provider return URL: thabaat://paid. Query parameters are not payment proof.
export default function PaymentReturn() {
 const load = useCallback(() => getPaidEventOrder(paidTestEventId), [])
 const { data, loading, error, reload } = useFocusResource(load, null)
 return <ScrollView contentContainerStyle={styles.page}>
  <Text style={styles.title}>Back to Thabaat</Text>
  <Text style={styles.text}>{loading ? 'Checking your saved payment status…' : data?.status === 'completed' ? 'Payment verified. Your event access is ready.' : data?.status === 'refunded' ? 'Payment refunded. Event access is locked.' : data?.status === 'cancelled' ? 'Checkout cancelled. Event access is locked.' : 'Payment is not verified yet. If you paid, do not pay again. The team must verify your payment.'}</Text>
  {!!error && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
  <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={loading} onPress={() => void reload()}><Text>Refresh status</Text></TouchableOpacity>
  {isPaymentCheckEnabled && data && <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.replace(`/payments/event/${paidTestEventId}`)}><Text>View event checkout</Text></TouchableOpacity>}
  <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.replace('/payments/history')}><Text>Payment history</Text></TouchableOpacity>
 </ScrollView>
}
const styles = StyleSheet.create({ page: { flexGrow: 1, backgroundColor: '#000', padding: 24, gap: 20 }, title: { color: '#fff', fontSize: 26, fontWeight: '700' }, text: { color: '#ddd', fontSize: 16, lineHeight: 24 }, button: { backgroundColor: '#fff', padding: 16, borderRadius: 10 } })
