import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

export default function ConfirmationScreen() {
  const { eventTitle } = useLocalSearchParams<{ eventTitle: string }>()

  return (
    <View style={styles.container}>
      <Text style={styles.checkmark}>✓</Text>
      <Text style={styles.title}>You're Registered!</Text>
      <Text style={styles.subtitle}>
        {eventTitle
          ? `You have successfully registered for ${decodeURIComponent(eventTitle)}`
          : 'Your registration was successful'}
      </Text>

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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 32
  },
  checkmark: {
    fontSize: 64,
    color: '#4ade80',
    marginBottom: 16
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24
  },
  button: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold'
  },
  secondaryButton: {
    padding: 16,
    alignItems: 'center',
    width: '100%'
  },
  secondaryButtonText: {
    color: '#aaa',
    fontSize: 16
  }
})