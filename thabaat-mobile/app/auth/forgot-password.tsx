import { authRedirectUrl } from '@/lib/auth-links'
import { Alert } from '@/lib/alert'
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { brand, fonts } from '@/constants/brand';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResetRequest() {
    if (loading) return;
    try {
      if (!email) {
        Alert.alert('Missing information', 'Please enter your email.');
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl('reset-password'),
      });

      setLoading(false);

      if (error) {
        Alert.alert('Something went wrong', error.message);
        return;
      }

      Alert.alert(
        'Check your email',
        'We sent you a password reset link.'
      );
    } catch (error) {
      Alert.alert('Unable to complete request', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password?</Text>

      <Text style={styles.subtitle}>
        Enter your email and we&apos;ll send you a link to reset your password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={brand.sage}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <PressableScale
        style={styles.button}
        onPress={handleResetRequest}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </Text>
      </PressableScale>

      <PressableScale onPress={() => router.push('/auth/login')}>
        <Text style={styles.link}>Back to Login</Text>
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

  title: {
    fontSize: 26,
    fontFamily: fonts.heading,
    color: brand.ink,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: brand.inkMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
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
    marginBottom: 16,
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
    color: brand.page,
    fontSize: 16,
    fontFamily: fonts.heading,
  },

  link: {
    color: brand.tealText,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});