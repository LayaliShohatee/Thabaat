import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams()

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Event Detail</Text>
      <Text style={styles.sub}>ID: {id}</Text>
      <Text style={styles.sub}>Eman builds this screen</Text>
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