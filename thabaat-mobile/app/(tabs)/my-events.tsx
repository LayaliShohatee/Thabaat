import { StyleSheet, Text, View } from 'react-native';

export default function MyEventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Events</Text>
      <Text>Events you register for will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});