import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function EditProfileScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setName(user.user_metadata?.full_name ?? '');
      setEmail(user.email ?? '');
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!name) {
      Alert.alert('Missing information', 'Please enter your name.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: name,
      },
    });

    if (error) {
      setSaving(false);
      Alert.alert('Update failed', error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from('profiles')
        .update({
          full_name: name,
        })
        .eq('id', user.id);
    }

    setSaving(false);

    Alert.alert(
      'Profile updated',
      'Your profile has been updated.',
      [
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]
    );
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

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});