import { authRedirectUrl } from '@/lib/auth-links'
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {eventReturnPath} from '@/lib/event-sharing';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const {eventId}=useLocalSearchParams<{eventId?:string}>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleRegister() {
    if (loading) return;
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage('Account creation is unavailable in this preview. The account service has not been connected yet.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: authRedirectUrl('callback'),
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace(eventReturnPath(eventId)??'/(tabs)');
        return;
      }

      setSuccessMessage(eventReturnPath(eventId)?'Check your email to verify your account, then return to this shared link to sign in.':'Check your email for a verification link before logging in.');
    } catch {
      setErrorMessage('Unable to reach the account service. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Thabaat</Text>

      <Text style={styles.title}>Create your account</Text>

      <Text style={styles.subtitle}>
        Join Thabaat and discover community events.
      </Text>

      {!isSupabaseConfigured && (
        <Text style={styles.feedback} accessibilityRole="alert">
          This preview is not connected to the account service. Sign-up is unavailable.
        </Text>
      )}

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

      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">{errorMessage}</Text>
      ) : null}
      {successMessage ? (
        <Text style={styles.feedback} accessibilityLiveRegion="polite">{successMessage}</Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating account...' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push(eventReturnPath(eventId)?{pathname:'/auth/login',params:{eventId}}:'/auth/login')}>
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

  feedback: {
    color: '#38584F',
    marginBottom: 16,
    textAlign: 'center',
  },

  error: {
    color: '#B42318',
    marginBottom: 16,
    textAlign: 'center',
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