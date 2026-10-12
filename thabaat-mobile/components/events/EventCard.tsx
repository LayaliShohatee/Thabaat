import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { brand, shadow } from '@/constants/brand'
import { router } from 'expo-router'
import { Event } from '@/types'

interface Props {
  event: Event
}

export default function EventCard({ event }: Props) {
  const handlePress = () => {
    router.push(`/event/${event.id}`)
  }

  const formattedDate = new Date(event.event_date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const formattedTime = new Date(event.event_date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={handlePress}
    >
      {event.image_url ? (
        <Image
          source={{ uri: event.image_url }}
          style={styles.image}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>THABAAT</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <Text style={styles.date}>
          {formattedDate} • {formattedTime}
        </Text>

        <Text style={styles.location} numberOfLines={1}>
          {event.location}
        </Text>

        {event.speaker_name && (
          <Text style={styles.speaker} numberOfLines={1}>
            Speaker: {event.speaker_name}
          </Text>
        )}

        <Text style={styles.description} numberOfLines={2}>
          {event.description}
        </Text>

        <Text style={styles.viewEvent}>
          View Event →
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: brand.card, borderWidth: 1, borderColor: brand.line, ...shadow,
    borderRadius: 12,
    overflow: 'hidden',
  },

  cardPressed: {
    opacity: 0.7,
  },

  image: {
    width: '100%',
    height: 180,
  },

  imagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: brand.green,
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderText: {
    color: brand.gold,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
  },

  content: {
    padding: 16,
  },

  title: {
    color: brand.ink,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  date: {
    color: brand.green,
    fontSize: 14,
    marginBottom: 4,
  },

  location: {
    color: brand.inkMuted,
    fontSize: 14,
    marginBottom: 4,
  },

  speaker: {
    color: brand.inkMuted,
    fontSize: 14,
    marginBottom: 8,
  },

  description: {
    color: brand.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },

  viewEvent: {
    color: brand.green,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
})
