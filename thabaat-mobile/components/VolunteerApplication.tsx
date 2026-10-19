import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getVolunteerWork, submitVolunteerApplication, type VolunteerWork } from '@/services/staffService'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'

// Interim volunteer sign-up. Phase 3 replaces the free-text box with the client's volunteer form.
export function VolunteerApplication() {
 const {data:work,error,reload}=useFocusResource(getVolunteerWork,{application:null,assignments:[]} as VolunteerWork)
 const [motivation,setMotivation]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const locked=useRef(false)
 async function submit(){if(locked.current)return;locked.current=true;setBusy(true);setMessage('');try{await submitVolunteerApplication(motivation);setMotivation('');await reload();setMessage('Thanks! Your application was sent to the Thabaat team.')}catch(e){setMessage(e instanceof Error?e.message:'Request failed')}finally{locked.current=false;setBusy(false)}}
 return <View style={styles.card}>
  <Text style={styles.heading}>Volunteer with Thabaat</Text>
  {!!error&&<Text style={styles.alert}>{error}</Text>}
  <Text style={styles.text}>Application: {work.application?.status||'Not submitted'}</Text>
  {work.application?.status!=='approved'&&<><TextInput accessibilityLabel="Volunteer interests" style={styles.input} placeholder="How would you like to help? (10–2000 characters)" value={motivation} onChangeText={setMotivation} multiline maxLength={2000}/>
  <Button label={busy?'Sending…':'Apply to volunteer'} disabled={busy||motivation.trim().length<10} onPress={()=>void submit()}/></>}
  {work.assignments.length>0&&<Button label="My shifts" disabled={busy} onPress={()=>router.push('/volunteer-shifts')}/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
 </View>
}
