import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

export default function RegistrationScreen() {
  const { eventId } = useLocalSearchParams()

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Registration</Text>
      <Text style={styles.sub}>Event ID: {eventId}</Text>
      <Text style={styles.sub}>Hussein builds this screen</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 16
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  sub: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8
  }
})