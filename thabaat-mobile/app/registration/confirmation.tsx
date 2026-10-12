import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { brand } from '@/constants/brand'
import { router, useLocalSearchParams } from 'expo-router'
import RegisteredEventActions from '@/components/events/RegisteredEventActions'
import { isDemoMode } from '@/lib/demo-mode'
import SuggestedDonation from '@/components/SuggestedDonation'

export default function ConfirmationScreen() {
  const { eventTitle, notificationSent, freeRegistration, registrationId, eventId } = useLocalSearchParams<{ eventTitle: string; notificationSent?: string; freeRegistration?: string; registrationId?: string; eventId?: string }>()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.checkmark}>✓</Text>
      <Text style={styles.title}>You&apos;re Registered!</Text>
      <Text style={styles.subtitle}>
        {eventTitle
          ? `You have successfully registered for ${eventTitle}`
          : 'Your registration was successful'}
      </Text>

      {!isDemoMode && notificationSent === 'false' && <Text style={styles.subtitle}>Your registration is saved. Push confirmation may be disabled or awaiting delivery.</Text>}
      {registrationId && eventId && <RegisteredEventActions registrationId={registrationId} eventId={eventId} />}
      {!isDemoMode && freeRegistration === 'true' && <SuggestedDonation styles={styles} />}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.buttonText}>Back to Events</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.replace('/(tabs)/my-events')}
      >
        <Text style={styles.secondaryButtonText}>View My Events</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: brand.page,
    padding: 32
  },
  checkmark: {
    fontSize: 64,
    color: brand.green,
    marginBottom: 16
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: brand.ink,
    marginBottom: 12,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: brand.inkMuted,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24
  },
  button: {
    backgroundColor: brand.green,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  secondaryButton: {
    padding: 16,
    alignItems: 'center',
    width: '100%'
  },
  secondaryButtonText: {
    color: brand.inkMuted,
    fontSize: 16
  }
})
