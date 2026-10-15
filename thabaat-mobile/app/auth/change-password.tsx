import { Alert } from '@/lib/alert'
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { brand } from '@/constants/brand'

export default function ChangePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChangePassword() {
    if (loading) return;
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
            text: 'Done',
            onPress: () => router.back(),
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
      <Text style={styles.title}>Change Password</Text>

      <Text style={styles.subtitle}>
        Enter and confirm your new password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor={brand.sage}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        placeholderTextColor={brand.sage}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleChangePassword}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Updating...' : 'Change Password'}
        </Text>
      </TouchableOpacity>
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
    fontWeight: '700',
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

  button: {
    height: 50,
    backgroundColor: brand.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  buttonText: {
    color: brand.page,
    fontSize: 16,
    fontWeight: '600',
  },
});