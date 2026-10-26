import { router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getVolunteerWork, type VolunteerWork } from '@/services/staffService'
import { openVolunteerForm } from '@/lib/volunteer-form'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'

// "Volunteer with Thabaat": opens the client's Google volunteer interest form, which is where applications are submitted.
export function VolunteerApplication({ heading = 'Volunteer with Thabaat', showShifts = true }: { heading?: string; showShifts?: boolean }) {
 const { data: work } = useFocusResource(getVolunteerWork, { application: null, assignments: [] } as VolunteerWork)
 const [message, setMessage] = useState('')
 const open = () => { setMessage(''); openVolunteerForm().catch(() => setMessage('Couldn’t open the volunteer form. Check your connection and try again.')) }
 return <View style={styles.card}>
  <Text style={styles.heading}>{heading}</Text>
  <Text style={styles.text}>Interested in joining the team? Fill out the Thabaat Volunteer Interest Form and the team will reach out insha’Allah. It opens in your browser and needs a Google sign-in.</Text>
  <Button label="Open the volunteer form" onPress={open} />
  {showShifts && work.assignments.length > 0 && <Button label="My shifts" onPress={() => router.push('/volunteer-shifts')} />}
  {!!message && <Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
 </View>
}
