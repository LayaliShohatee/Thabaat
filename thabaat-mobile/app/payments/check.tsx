import { Redirect } from 'expo-router'
import { paidTestEventId } from '@/lib/paid-event-test'
export default function PaymentCheckScreen() {
 return <Redirect href={`/payments/event/${paidTestEventId}`} />
}
