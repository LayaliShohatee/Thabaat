import { Alert } from '@/lib/alert'
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Gender = 'female' | 'male' | 'prefer_not_to_say' | null;
const GENDERS: [Gender, string][] = [['female', 'Female'], ['male', 'Male'], ['prefer_not_to_say', 'Prefer not to say'], [null, 'Not set']];

export default function EditProfileScreen() {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [birthYear, setBirthYear] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user }, error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      if (user) {
        setName(user.user_metadata?.full_name ?? '');
        setEmail(user.email ?? '');
        const { data: profile } = await supabase.from('profiles').select('gender,birth_year').eq('id', user.id).maybeSingle();
        setGender((profile?.gender as Gender) ?? null);
        setBirthYear(profile?.birth_year ? String(profile.birth_year) : '');
      }

      setLoading(false);
    }

    void loadProfile().catch(() => { Alert.alert('Unable to load profile', 'Please try again.'); }).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (saving) return;
    if (!name.trim()) {
      Alert.alert('Missing information', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Please log in again.');
      const year = birthYear.trim() ? Number(birthYear) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) throw new Error('Enter a four-digit birth year, or leave it blank.');
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id, full_name: name.trim(), email: user.email, gender, birth_year: year,
      }, { onConflict: 'id' });
      if (profileError) throw profileError;
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (error) throw error;
      Alert.alert('Profile updated', 'Your profile has been updated.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#159A8C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Full Name</Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Full name"
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Email</Text>

      <TextInput
        style={[styles.input, styles.disabledInput]}
        value={email}
        editable={false}
      />

      <Text style={styles.emailNote}>
        Your email is connected to your Thabaat account.
      </Text>

      <Text style={styles.label}>Gender (optional)</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {GENDERS.map(([value, label]) => (
          <TouchableOpacity key={label} accessibilityRole="button" accessibilityState={{ selected: gender === value }} onPress={() => setGender(value)} style={[styles.choice, gender === value && styles.choiceSelected]}>
            <Text style={[styles.choiceText, gender === value && styles.choiceTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Birth year (optional)</Text>
      <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} placeholder="e.g. 1998" placeholderTextColor="#888" keyboardType="number-pad" maxLength={4} />
      <Text style={styles.emailNote}>Used only so event organizers can see attendee age groups and gender totals.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 35,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
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
    marginBottom: 20,
  },

  disabledInput: {
    color: '#777777',
  },

  emailNote: {
    fontSize: 12,
    color: '#777777',
    marginTop: -12,
    marginBottom: 25,
  },

  button: {
    height: 50,
    backgroundColor: '#159A8C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  choice: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E1E8E6', backgroundColor: '#F5F8F7' },
  choiceSelected: { backgroundColor: '#159A8C', borderColor: '#159A8C' },
  choiceText: { color: '#222222', fontSize: 14 },
  choiceTextSelected: { color: '#FFFFFF', fontWeight: '600' },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});