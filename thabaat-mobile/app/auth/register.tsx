import { authRedirectUrl } from '@/lib/auth-links'
import { brand, fonts } from '@/constants/brand'
import { BrandLogo } from '@/components/BrandLogo'
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { router, useLocalSearchParams } from 'expo-router';
import {eventReturnPath} from '@/lib/event-sharing';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle'
import { ManagementChip as Chip } from '@/components/ManagementUI'
import { GENDER_OPTIONS, birthYearFromAge, parseAge, type Gender } from '@/lib/attendee'

export default function RegisterScreen() {
  useStatusBarStyle('dark')
  const {eventId}=useLocalSearchParams<{eventId?:string}>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleRegister() {
    if (loading) return;
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim() || !email.trim() || !password || !age.trim() || !gender) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    const parsedAge = parseAge(age, 13);
    if (parsedAge === null) {
      setErrorMessage('Enter an age from 13 to 120.');
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
          data: { full_name: name.trim(), gender, birth_year: String(birthYearFromAge(parsedAge)) },
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
    <ScrollView style={{ backgroundColor: brand.card }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

      <TextInput
        style={styles.input}
        placeholder="Age"
        placeholderTextColor={brand.sage}
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel="Age"
      />

      <Text style={styles.fieldLabel}>Gender</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {GENDER_OPTIONS.map(option => <Chip key={option.value} label={option.label} selected={gender === option.value} onPress={() => setGender(option.value)} />)}
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingVertical: 32,
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

  fieldLabel: {
    fontSize: 14,
    fontFamily: fonts.label,
    color: brand.ink,
    marginBottom: 8,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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