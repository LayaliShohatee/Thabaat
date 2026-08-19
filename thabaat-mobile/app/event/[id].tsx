import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState } from 'react'
import { getEventById } from '@/services/eventService'
import { checkExistingRegistration } from '@/services/registrationService'
import { useAuth } from '@/hooks/useAuth'
import { Event } from '@/types'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)

  useEffect(() => {
    if (!id) return

    Promise.all([
      getEventById(id),
      user ? checkExistingRegistration(user.id, id) : Promise.resolve(false)
    ])
      .then(([eventData, registered]) => {
        setEvent(eventData)
        setAlreadyRegistered(registered)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, user])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    )
  }

  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
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
        {event.speaker_name && (
          <Text style={styles.speaker}>Speaker: {event.speaker_name}</Text>
        )}
        <Text style={styles.sectionTitle}>About this event</Text>
        <Text style={styles.description}>{event.description}</Text>
      </View>

      <View style={styles.footer}>
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
    backgroundColor: '#000'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
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
    color: '#fff',
    marginBottom: 8
  },
  date: {
    fontSize: 15,
    color: '#aaa',
    marginBottom: 4
  },
  location: {
    fontSize: 15,
    color: '#aaa',
    marginBottom: 4
  },
  speaker: {
    fontSize: 15,
    color: '#aaa',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8
  },
  description: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22
  },
  footer: {
    padding: 20,
    paddingBottom: 40
  },
  registerButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  registeredButton: {
    backgroundColor: '#333'
  },
  registerButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold'
  },
  errorText: {
    color: '#fff',
    fontSize: 16
  }
})