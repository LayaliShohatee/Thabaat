import { useRef, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { fonts } from '@/constants/brand'
import { VOLUNTEER_LABELS } from '@/lib/volunteer-form'
import type { Permissions } from '@/services/managementService'
import { getVolunteerApplications, reviewVolunteerApplication, volunteerResumeUrl, type VolunteerApplication } from '@/services/staffService'
import { ManagementButton as Button, ManagementLink as Link, managementStyles as styles } from './ManagementUI'
// Volunteer application review. Per-event volunteer assignments live on each event's Manage page.
export function StaffTools({permissions}:{permissions:Permissions}) {
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [applications,setApplications]=useState<VolunteerApplication[]>([])
 const locked=useRef(false)
 async function run(action:()=>Promise<void>) {if(locked.current)return;locked.current=true;setBusy(true);setMessage('');try{await action()}catch(e){setMessage(e instanceof Error?e.message:'Request failed')}finally{locked.current=false;setBusy(false)}}
 return <>
  {permissions.can_manage_roles&&<View style={styles.card}><Text style={styles.heading}>Review volunteer applications</Text><Button label="Load applications" disabled={busy} onPress={()=>void run(async()=>setApplications(await getVolunteerApplications()))}/>{applications.map(a=><View key={a.user_id} style={styles.card}><Text style={styles.heading}>{a.full_name} · {a.status}</Text>{a.answers?Object.entries(a.answers).map(([key,value])=><Text key={key} style={styles.text}><Text style={{fontFamily:fonts.label}}>{VOLUNTEER_LABELS[key]??key}: </Text>{Array.isArray(value)?value.join(', '):String(value)}</Text>):<Text style={styles.text}>{a.motivation}</Text>}{!!a.resume_path&&<Link label="Open resume (PDF)" disabled={busy} onPress={()=>void run(async()=>{await Linking.openURL(await volunteerResumeUrl(a.resume_path!))})}/>}{(['approved','declined'] as const).map(status=><Button key={status} label={status==='approved'?'Approve (gives the Volunteer role)':'Decline application'} disabled={busy||a.status===status} onPress={()=>void run(async()=>{await reviewVolunteerApplication(a.user_id!,status);setApplications(await getVolunteerApplications());setMessage(status==='approved'?'Approved. They now have the Volunteer role and can sign up to volunteer at events.':'Declined. Their account role is unchanged.')})}/>)}</View>)}</View>}
  {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
 </>
}
