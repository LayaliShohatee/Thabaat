import * as Linking from 'expo-linking';
import { consumeAuthLink } from '@/lib/auth-links';
import { Alert } from '@/lib/alert'
import { useEffect, useState } from 'react';
import {
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
  const url = Linking.useURL();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    let active = true;
    async function verifyLink() {
      try {
        const incoming = url ?? await Linking.getInitialURL();
        if (!incoming) throw new Error('Open the password reset link from your email.');
        await consumeAuthLink(incoming);
        if (active) { setReady(true); setLinkError(''); }
      } catch (err) {
        if (active) { setReady(false); setLinkError(err instanceof Error ? err.message : 'This reset link is invalid.'); }
      }
    }
    void verifyLink();
    return () => { active = false; };
  }, [url]);


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
    <View style={styles.container}>
      <Text style={styles.title}>Create a New Password</Text>

      <Text style={styles.subtitle}>
        Enter your new password below.
      </Text>

      {linkError ? <Text accessibilityRole="alert">{linkError}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        placeholderTextColor="#888"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleUpdatePassword}
        disabled={loading || !ready}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Updating...' : 'Update Password'}
        </Text>
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

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});