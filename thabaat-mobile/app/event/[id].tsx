import { useFocusResource } from '@/hooks/useFocusResource'
import { brand } from '@/constants/brand'
import { Alert } from '@/lib/alert'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useCallback } from 'react'
import { getEventById } from '@/services/eventService'
import { checkExistingRegistration } from '@/services/registrationService'
import { useAuth } from '@/hooks/useAuth'
import { paidTestEventId } from '@/lib/paid-event-test'
import { EventStructuredDetails } from '@/components/EventStructuredDetails'
import type { EventDetails } from '@/lib/event-details'
import { Event } from '@/types'
import CalendarActions from '@/components/events/CalendarActions'
import EventShareActions from '@/components/events/EventShareActions'
import { isDemoMode } from '@/lib/demo-mode'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const load = useCallback(async (): Promise<[Event | null, boolean]> => {
    if (!id) throw new Error('Missing event ID.')
    return Promise.all([getEventById(id), user ? checkExistingRegistration(user.id, id) : Promise.resolve(false)])
  }, [id, user])
  const { data: [event, alreadyRegistered], loading, error, reload } = useFocusResource(load, [null, false])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brand.green} />
      </View>
    )
  }

  if (error) return <View style={styles.centered}><Text style={styles.errorText} accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.registerButton} onPress={reload}><Text>Try Again</Text></TouchableOpacity></View>

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    )
  }

  const formattedDate = new Date(event.event_date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const handleRegister = () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to register for events')
      return
    }
    router.push(`/registration/${id}`)
  }

  return (
    <ScrollView style={styles.container}>
      {event.image_url && (
        <Image
          source={{ uri: event.image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.date}>{formattedDate}</Text>
        <Text style={styles.location}>{event.location}</Text>
        <EventStructuredDetails event={event as Event & EventDetails}/>
        {!isDemoMode && <TouchableOpacity accessibilityRole="button" style={styles.registerButton} onPress={()=>router.push(`/waitlist/${id}`)}><Text style={styles.registerButtonText}>Waitlist options</Text></TouchableOpacity>}
        <Text style={styles.sectionTitle}>About this event</Text>
        <Text style={styles.description}>{event.description}</Text>
      </View>

      <View style={styles.footer}>
        <CalendarActions event={event} />
        {!isDemoMode && <EventShareActions eventId={event.id}/>}
        {alreadyRegistered && id === paidTestEventId && <TouchableOpacity accessibilityRole="button" style={styles.registerButton} onPress={() => router.push(`/event/access/${id}`)}><Text style={styles.registerButtonText}>Open paid event access</Text></TouchableOpacity>}
        <TouchableOpacity
          style={[
            styles.registerButton,
            alreadyRegistered && styles.registeredButton
          ]}
          onPress={handleRegister}
          disabled={alreadyRegistered}
        >
          <Text style={styles.registerButtonText}>
            {alreadyRegistered ? 'Already Registered' : 'Register for Event'}
          </Text>
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
  image: {
    width: '100%',
    height: 250
  },
  content: {
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: brand.ink,
    marginBottom: 8
  },
  date: {
    fontSize: 15,
    color: brand.inkMuted,
    marginBottom: 4
  },
  location: {
    fontSize: 15,
    color: brand.inkMuted,
    marginBottom: 4
  },
  speaker: {
    fontSize: 15,
    color: brand.inkMuted,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: brand.ink,
    marginTop: 16,
    marginBottom: 8
  },
  description: {
    fontSize: 15,
    color: brand.inkMuted,
    lineHeight: 22
  },
  footer: {
    padding: 20,
    paddingBottom: 40
  },
  registerButton: {
    backgroundColor: brand.green,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  registeredButton: {
    backgroundColor: brand.greenSoft
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  errorText: {
    color: brand.ink,
    fontSize: 16
  }
})
