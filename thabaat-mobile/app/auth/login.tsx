import { Alert } from '@/lib/alert'
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
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const {eventId}=useLocalSearchParams<{eventId?:string}>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading) return;
    try {
      if (!email || !password) {
        Alert.alert('Missing information', 'Please enter your email and password.');
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      setLoading(false);

      if (error) {
        Alert.alert('Login failed', error.message);
        return;
      }

      router.replace(eventReturnPath(eventId) ?? '/(tabs)');
    } catch (error) {
      Alert.alert('Unable to complete request', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Thabaat</Text>

      <Text style={styles.title}>Welcome back</Text>
      {eventReturnPath(eventId)?<Text style={{color:'#bbb',marginBottom:12}}>Sign in to open the shared event.</Text>:null}

      <Text style={styles.subtitle}>
        Log in to your account
      </Text>

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
        autoCapitalize="none"
        secureTextEntry
      />

      <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
        <Text style={styles.forgot}>Forgot your password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Log In'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push(eventReturnPath(eventId)?{pathname:'/auth/register',params:{eventId}}:'/auth/register')}>
        <Text style={styles.link}>
          Don&apos;t have an account? Create one
        </Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/public')}>
        <Text style={styles.link}>Browse public events without signing in</Text>
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

  forgot: {
    color: '#159A8C',
    textAlign: 'right',
    fontSize: 14,
    marginBottom: 18,
  },

  button: {
    height: 50,
    backgroundColor: '#159A8C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  }, });
