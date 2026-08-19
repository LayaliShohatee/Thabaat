import { View, Text } from 'react-native'
import { Event } from '@/types'

interface Props {
  event: Event
}

export default function EventCard({ event }: Props) {
  return (
    <View>
      <Text>{event.title}</Text>
    </View>
  )
}