import { authRedirectUrl } from '@/lib/auth-links'
import { brand, fonts } from '@/constants/brand'
import { BrandLogo } from '@/components/BrandLogo'
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { router, useLocalSearchParams } from 'expo-router';
import {eventReturnPath} from '@/lib/event-sharing';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle'

export default function RegisterScreen() {
  useStatusBarStyle('dark')
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
      <BrandLogo height={36} style={styles.logo} />

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
        placeholderTextColor={brand.sage}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={brand.sage}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={brand.sage}
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

      <PressableScale
        accessibilityRole="button"
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating account...' : 'Create Account'}
        </Text>
      </PressableScale>

      <PressableScale onPress={() => router.push(eventReturnPath(eventId)?{pathname:'/auth/login',params:{eventId}}:'/auth/login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.card,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  logo: {
    alignSelf: 'center',
    marginBottom: 24,
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

  feedback: {
    color: brand.inkMuted,
    marginBottom: 16,
    textAlign: 'center',
  },

  error: {
    color: brand.danger,
    marginBottom: 16,
    textAlign: 'center',
  },

  button: {
    height: 50,
    backgroundColor: brand.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  buttonText: {
    color: brand.page,
    fontSize: 16,
    fontFamily: fonts.heading,
  },

  link: {
    color: brand.primary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});