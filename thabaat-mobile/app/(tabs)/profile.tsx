import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import { router } from 'expo-router'

export default function ProfileScreen() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/auth/register')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
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
    padding: 24
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 32
  },
  button: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%'
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold'
  }
})