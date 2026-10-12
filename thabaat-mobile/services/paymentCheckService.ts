import { openBrowserAsync } from 'expo-web-browser'
import { isPaymentCheckEnabled, paymentCheck } from '@/lib/payment-check'

export async function openPaymentCheck(): Promise<void> {
  if (!isPaymentCheckEnabled) throw new Error('Payment check is not enabled in this build.')

  // No Supabase session, personal details, or payment credentials are put in the URL.
  // Browser open/dismiss results cannot establish whether a payment succeeded.
  await openBrowserAsync(paymentCheck.url, {
    dismissButtonStyle: 'done',
    toolbarColor: '#111111',
    controlsColor: '#ffffff',
    windowName: '_blank',
  })
}
