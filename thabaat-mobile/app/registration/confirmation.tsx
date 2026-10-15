import { ScrollView, Text, StyleSheet, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { brand, fonts } from '@/constants/brand'
import { router, useLocalSearchParams } from 'expo-router'
import RegisteredEventActions from '@/components/events/RegisteredEventActions'
import { isDemoMode } from '@/lib/demo-mode'
import SuggestedDonation from '@/components/SuggestedDonation'
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle'

export default function ConfirmationScreen() {
  useStatusBarStyle('dark')
  const { eventTitle, notificationSent, freeRegistration, registrationId, eventId, testCharge } = useLocalSearchParams<{ eventTitle: string; notificationSent?: string; freeRegistration?: string; registrationId?: string; eventId?: string; testCharge?: string }>()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.checkCircle} accessible={false}><Text style={styles.checkmark}>✓</Text></View>
      <Text style={styles.title}>You&apos;re Registered!</Text>
      <Text style={styles.subtitle}>
        {eventTitle
          ? `You have successfully registered for ${eventTitle}`
          : 'Your registration was successful'}
      </Text>

      {testCharge !== undefined && <Text style={styles.subtitle}>Paid ${(Number(testCharge) / 100).toFixed(2)} — test payment, no money was charged. Your ticket is in Events → My tickets.</Text>}
      {!isDemoMode && notificationSent === 'false' && <Text style={styles.subtitle}>Your registration is saved. Push confirmation may be disabled or awaiting delivery.</Text>}
      {registrationId && eventId && <RegisteredEventActions registrationId={registrationId} eventId={eventId} />}
      {!isDemoMode && freeRegistration === 'true' && <SuggestedDonation styles={styles} />}
      <PressableScale
        accessibilityRole="button"
        style={styles.button}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.buttonText}>Back to Events</Text>
      </PressableScale>

      <PressableScale
        accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={() => router.replace('/(tabs)/events?view=tickets')}
      >
        <Text style={styles.secondaryButtonText}>View my tickets</Text>
      </PressableScale>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: brand.page, padding: 28, gap: 4 },
  checkCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  checkmark: { fontSize: 38, color: '#FFFFFF', fontFamily: fonts.headingHeavy, lineHeight: 44 },
  title: { fontSize: 28, fontFamily: fonts.headingHeavy, letterSpacing: -0.4, color: brand.ink, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: brand.inkMuted, textAlign: 'center', marginBottom: 24, lineHeight: 23 },
  button: { backgroundColor: brand.primary, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.heading },
  secondaryButton: { paddingVertical: 14, alignItems: 'center', width: '100%' },
  secondaryButtonText: { color: brand.primary, fontSize: 15, fontFamily: fonts.label },
})
