import { View, Text } from 'react-native'
import { Registration } from '@/types'

interface Props {
  registration: Partial<Registration>
}

export default function ConfirmationCard({ registration }: Props) {
  return (
    <View>
      <Text>Confirmation — Hussein builds this</Text>
    </View>
  )
}