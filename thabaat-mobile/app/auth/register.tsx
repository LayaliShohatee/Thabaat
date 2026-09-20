import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert('Missing information', 'Please fill in all fields.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        emailRedirectTo: 'thabaat://auth/callback',
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert('Registration failed', error.message);
      return;
    }

    Alert.alert(
      'Check your email',
      'Your account was created. Please check your email to verify your account.',
      [
        {
          text: 'OK',
          onPress: () => router.replace('/auth/login'),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Thabaat</Text>

      <Text style={styles.title}>Create your account</Text>

      <Text style={styles.subtitle}>
        Join Thabaat and discover community events.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating account...' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/auth/login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#159A8C',
    textAlign: 'center',
    marginBottom: 25,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#222222',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  input: {
    height: 50,
    backgroundColor: '#F5F8F7',
    borderWidth: 1,
    borderColor: '#E1E8E6',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#222222',
    marginBottom: 14,
  },

  button: {
    height: 50,
    backgroundColor: '#159A8C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  link: {
    color: '#159A8C',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});