import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

export default function MembershipScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Membership</Text>

      <View style={styles.currentCard}>
        <Text style={styles.smallTitle}>CURRENT PLAN</Text>

        <Text style={styles.plan}>Free</Text>

        <Text style={styles.description}>
          You are currently using the free Thabaat membership.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Membership Plans</Text>

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Free</Text>
        <Text style={styles.price}>$0</Text>

        <Text style={styles.planDescription}>
          Access the basic Thabaat experience.
        </Text>

        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>Current Plan</Text>
        </View>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Paid</Text>
        <Text style={styles.price}>Coming Soon</Text>

        <Text style={styles.planDescription}>
          More membership benefits will be available here.
        </Text>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Coming Soon</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>Back to Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 25,
  },

  currentCard: {
    backgroundColor: '#E8F5F3',
    borderRadius: 16,
    padding: 22,
    marginBottom: 30,
  },

  smallTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#159A8C',
    marginBottom: 8,
    letterSpacing: 1,
  },

  plan: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 6,
  },

  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 12,
  },

  planCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E8E6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
  },

  planTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#222222',
  },

  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#159A8C',
    marginTop: 5,
    marginBottom: 8,
  },

  planDescription: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 19,
    marginBottom: 15,
  },

  currentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  currentBadgeText: {
    color: '#159A8C',
    fontSize: 12,
    fontWeight: '600',
  },

  button: {
    height: 44,
    backgroundColor: '#159A8C',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  back: {
    textAlign: 'center',
    color: '#159A8C',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
  },
});