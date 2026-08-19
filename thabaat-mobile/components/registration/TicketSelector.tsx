import { View, Text } from 'react-native'
import { TicketType } from '@/types'

interface Props {
  tickets: TicketType[]
  onSelect: (ticket: TicketType) => void
}

export default function TicketSelector({ tickets, onSelect }: Props) {
  return (
    <View>
      <Text>Ticket Selector — Hussein builds this</Text>
    </View>
  )
}