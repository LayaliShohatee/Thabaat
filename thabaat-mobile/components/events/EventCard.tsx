import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { brand, fonts, shadow } from '@/constants/brand'
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

  const month = new Date(event.event_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = new Date(event.event_date).getDate()

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
      <View>
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
        <View style={styles.dateBadge} accessible={false}>
          <Text style={styles.dateBadgeMonth}>{month}</Text>
          <Text style={styles.dateBadgeDay}>{day}</Text>
        </View>
      </View>

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
          View and register →
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
    borderRadius: brand.radius,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.8 },
  image: { width: '100%', height: 180 },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: brand.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { color: brand.teal, fontSize: 20, fontFamily: fonts.heading, letterSpacing: 6 },
  dateBadge: {
    position: 'absolute', left: 14, bottom: -22,
    backgroundColor: brand.gold, borderRadius: brand.radiusSmall,
    paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', ...shadow,
  },
  dateBadgeMonth: { color: brand.navy, fontSize: 11, fontFamily: fonts.heading, letterSpacing: 1 },
  dateBadgeDay: { color: brand.navy, fontSize: 20, fontFamily: fonts.headingHeavy, lineHeight: 24 },
  content: { padding: 16, paddingTop: 30 },
  title: { color: brand.ink, fontSize: 19, fontFamily: fonts.heading, marginBottom: 8 },
  date: { color: brand.primary, fontSize: 14, fontFamily: fonts.label, marginBottom: 4 },
  location: { color: brand.inkMuted, fontSize: 14, marginBottom: 4 },
  speaker: { color: brand.inkMuted, fontSize: 14, marginBottom: 8 },
  description: { color: brand.inkMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  viewEvent: { color: brand.primary, fontSize: 14, fontFamily: fonts.label, marginTop: 12 },
})
