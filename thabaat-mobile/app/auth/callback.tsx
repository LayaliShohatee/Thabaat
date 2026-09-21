import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Button } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { consumeAuthLink } from '@/lib/auth-links';

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function finish() {
      try {
        const incoming = url ?? await Linking.getInitialURL();
        if (!incoming) throw new Error('This link is missing. Please sign in or request a new link.');
        const recovery = await consumeAuthLink(incoming);
        if (active) router.replace(recovery ? '/auth/reset-password' : '/(tabs)');
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to verify this link.');
      }
    }
    void finish();
    return () => { active = false; };
  }, [url]);
  return <View style={styles.container}>
    {error ? <><Text style={styles.text} accessibilityRole="alert">{error}</Text><Button title="Back to login" onPress={() => router.replace('/auth/login')} /></> : <><ActivityIndicator color="#159A8C" /><Text style={styles.text}>Verifying your account...</Text></>}
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, text: { marginVertical: 16, textAlign: 'center' } });
