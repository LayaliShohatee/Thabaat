import { useCallback, useState } from 'react'
import { Switch, Text, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { ONBOARDING_STEPS, completeVolunteerOnboarding, getVolunteerOnboarding } from '@/services/backlogService'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'
// #141 Onboarding checklist that approved volunteers complete before their first shift.
export function VolunteerOnboarding() {
 const load=useCallback(()=>getVolunteerOnboarding(),[])
 const {data,error,reload}=useFocusResource(load,null as {approved:boolean;completed_at:string|null}|null)
 const [checked,setChecked]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 if(error||!data?.approved)return null
 if(data.completed_at)return <View style={styles.card}><Text style={styles.heading}>Volunteer onboarding complete</Text><Text style={styles.text}>Completed {new Date(data.completed_at).toLocaleDateString()}. You will get a reminder 24 hours before each shift.</Text></View>
 async function finish(){if(busy)return;setBusy(true);setMessage('');try{await completeVolunteerOnboarding(checked);await reload()}catch(e){setMessage(e instanceof Error?e.message:'Unable to save onboarding')}finally{setBusy(false)}}
 return <View style={styles.card}>
  <Text style={styles.heading}>Welcome, volunteer! Finish onboarding</Text>
  <Text style={styles.text}>Confirm each step before your first shift.</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  {ONBOARDING_STEPS.map(([id,label])=><View key={id} style={{flexDirection:'row',alignItems:'center',gap:12}}><Switch accessibilityLabel={label} value={checked.includes(id)} onValueChange={on=>setChecked(on?[...checked,id]:checked.filter(c=>c!==id))}/><Text style={[styles.text,{flex:1}]}>{label}</Text></View>)}
  <Button label={busy?'Saving…':'Complete onboarding'} disabled={busy||checked.length<ONBOARDING_STEPS.length} onPress={()=>void finish()}/>
 </View>
}
