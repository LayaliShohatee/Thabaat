import { StyleSheet, Text, TextInput, View } from 'react-native'
import { brand, fonts } from '@/constants/brand'
import { ManagementChip as Chip } from '@/components/ManagementUI'
import { GENDER_OPTIONS, type Guest } from '@/lib/attendee'

// One guest's details for a ticket in a booking.
export function AttendeeForm({ guest, onChange }: { guest: Guest; onChange: (guest: Guest) => void }) {
  const field = (key: 'first_name' | 'last_name' | 'email' | 'age', label: string, extra: object = {}) => <View style={styles.field}>
    <Text style={styles.label}>{label} *</Text>
    <TextInput accessibilityLabel={label} style={styles.input} value={guest[key]} onChangeText={value => onChange({ ...guest, [key]: value })} placeholderTextColor={brand.sage} {...extra} />
  </View>
  return <View style={{ gap: 12 }}>
    {field('first_name', 'First name', { autoCapitalize: 'words', maxLength: 60 })}
    {field('last_name', 'Last name', { autoCapitalize: 'words', maxLength: 60 })}
    {field('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none', maxLength: 254 })}
    {field('age', 'Age', { keyboardType: 'number-pad', maxLength: 3 })}
    <View style={styles.field}>
      <Text style={styles.label}>Gender *</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {GENDER_OPTIONS.map(option => <Chip key={option.value} label={option.label} selected={guest.gender === option.value} onPress={() => onChange({ ...guest, gender: option.value })} />)}
      </View>
    </View>
  </View>
}

export const attendeeStyles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontFamily: fonts.label, color: brand.ink },
  input: { borderWidth: 1, borderColor: brand.line, borderRadius: brand.radiusSmall, backgroundColor: brand.card, color: brand.ink, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
const styles = attendeeStyles
