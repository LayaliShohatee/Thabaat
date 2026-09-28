import * as Linking from 'expo-linking';
import { consumeAuthLink } from '@/lib/auth-links';
import { Alert } from '@/lib/alert'
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const url = Linking.useLinkingURL();
  const [attempt, setAttempt] = useState(0);
  const [verification, setVerification] = useState<{ url: string | null; attempt: number; error: string } | null>(null);
  const current = verification?.url === url && verification?.attempt === attempt;
  const linkError = current ? verification.error : '';
  const ready = Boolean(current && !linkError);
  useEffect(() => {
    let active = true;
    async function verifyLink() {
      try {
        const incoming = url;
        if (!incoming) throw new Error('Open the password reset link from your email.');
        await consumeAuthLink(incoming);
        if (active) setVerification({ url, attempt, error: '' });
      } catch (err) {
        if (active) setVerification({ url, attempt, error: err instanceof Error ? err.message : 'This reset link is invalid.' });
      }
    }
    void verifyLink();
    return () => { active = false; };
  }, [url, attempt]);


  async function handleUpdatePassword() {
    if (loading || !ready) return;
    try {
      if (!password || !confirmPassword) {
        Alert.alert('Missing information', 'Please fill in both fields.');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Passwords do not match', 'Please enter the same password twice.');
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      setLoading(false);

      if (error) {
        Alert.alert('Password update failed', error.message);
        return;
      }

      Alert.alert(
        'Password updated',
        'Your password has been changed.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Unable to complete request', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={styles.title}>Create a New Password</Text>

      <Text style={styles.subtitle}>
        Enter your new password below.
      </Text>

      {!ready && !linkError ? <View style={styles.status}>
        <ActivityIndicator color="#159A8C" />
        <Text style={styles.statusText} accessibilityLiveRegion="polite">Verifying your reset link...</Text>
      </View> : null}
      {linkError ? <View style={styles.status}>
        <Text style={styles.error} accessibilityRole="alert">{linkError}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}>
          <Text style={styles.retry}>Try verifying again</Text>
        </TouchableOpacity>
      </View> : null}
      <TextInput
        style={styles.input}
        accessibilityLabel="New password"
        placeholder="New password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        accessibilityLabel="Confirm new password"
        placeholder="Confirm new password"
        placeholderTextColor="#888"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
        secureTextEntry
      />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: loading || !ready, busy: loading }}
        style={[styles.button, (loading || !ready) && styles.disabledButton]}
        onPress={handleUpdatePassword}
        disabled={loading || !ready}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Updating...' : !ready && !linkError ? 'Verifying link...' : 'Update Password'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flexGrow: 1,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
  },

  disabledButton: { opacity: 0.45 },
  status: { marginBottom: 18, alignItems: 'center', gap: 10 },
  statusText: { color: '#666666', textAlign: 'center' },
  error: { color: '#B42318', textAlign: 'center' },
  retry: { color: '#159A8C', fontWeight: '600', padding: 10 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});