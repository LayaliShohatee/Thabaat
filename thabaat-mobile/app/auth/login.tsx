import { Alert } from '@/lib/alert'
import { brand, fonts } from '@/constants/brand'
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { router, useLocalSearchParams } from 'expo-router';
import {eventReturnPath} from '@/lib/event-sharing';
import { supabase } from '@/lib/supabase';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle'

export default function LoginScreen() {
  useStatusBarStyle('dark')
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
      <Text style={styles.logo}>THABAAT</Text>

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

      <PressableScale onPress={() => router.push('/auth/forgot-password')}>
        <Text style={styles.forgot}>Forgot your password?</Text>
      </PressableScale>

      <PressableScale
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Log In'}
        </Text>
      </PressableScale>

      <PressableScale onPress={() => router.push(eventReturnPath(eventId)?{pathname:'/auth/register',params:{eventId}}:'/auth/register')}>
        <Text style={styles.link}>
          Don&apos;t have an account? Create one
        </Text>
      </PressableScale>
      <PressableScale accessibilityRole="button" onPress={() => router.push('/public')}>
        <Text style={styles.link}>Browse public events without signing in</Text>
      </PressableScale>
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
    fontSize: 26,
    fontFamily: fonts.heading,
    letterSpacing: 7,
    color: brand.teal,
    textAlign: 'center',
    marginBottom: 25,
  },

  title: {
    fontSize: 26,
    fontFamily: fonts.headingHeavy,
    color: brand.ink,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: brand.inkMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  input: {
    height: 50,
    backgroundColor: brand.page,
    borderWidth: 1,
    borderColor: brand.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: brand.ink,
    marginBottom: 14,
  },

  forgot: {
    color: brand.primary,
    textAlign: 'right',
    fontSize: 14,
    marginBottom: 18,
  },

  button: {
    height: 50,
    backgroundColor: brand.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.heading,
  },

  link: {
    color: brand.primary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  }, });
