import {useCallback,useState} from 'react'
import {Text,View} from 'react-native'
import {useFocusResource} from '@/hooks/useFocusResource'
import {getAttendanceReport,setNoShow,type AttendanceReport} from '@/services/ticketService'
import {ManagementButton as Button,managementStyles as styles} from '@/components/ManagementUI'
export default function EventAttendanceRoster({eventId}:{eventId:string}){
 const load=useCallback(()=>getAttendanceReport(eventId),[eventId])
 const {data,loading,error,reload}=useFocusResource(load,null as AttendanceReport|null,5000)
 const [busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState('')
 async function mark(id:string,noShow:boolean){if(busy)return;setBusy(id);setMessage('');try{await setNoShow(id,noShow);await reload()}catch(e){setMessage(e instanceof Error?e.message:'Unable to update no-show')}finally{setBusy(null)}}
 return <View style={styles.card}><Text style={styles.heading}>Attendee check-ins</Text>
 {loading&&!data&&<Text style={styles.text}>Loading attendee check-ins…</Text>}
 {!!(error||message)&&<Text accessibilityRole="alert" style={styles.alert}>{error||message}</Text>}
 {data&&!error&&<><Text style={styles.text}>{data.checked_in} checked in / {data.confirmed} confirmed{data.no_shows?` · ${data.no_shows} no-show${data.no_shows===1?'':'s'}`:''}</Text>
 {!data.event_started&&<Text style={styles.text}>No-shows can be marked once the event has started.</Text>}
 {data.attendees.length===0&&<Text style={styles.text}>No attendees yet.</Text>}
 {data.attendees.map(row=><View key={row.registration_id}><Text style={styles.heading}>{row.full_name||'Attendee'}</Text><Text accessibilityLiveRegion="polite" style={styles.text}>{row.checked_in_at?`Checked in · ${new Date(row.checked_in_at).toLocaleString()}`:row.no_show?'No-show':'Not checked in'}</Text><Text style={styles.text}>Booking: {row.status}</Text>
  {data.event_started&&!row.checked_in_at&&row.status==='confirmed'&&<Button label={busy===row.registration_id?'Saving…':row.no_show?`Undo no-show for ${row.full_name||'attendee'}`:`Mark ${row.full_name||'attendee'} as no-show`} disabled={!!busy} onPress={()=>void mark(row.registration_id,!row.no_show)}/>}
 </View>)}
 </>}
 <Button label={loading?'Refreshing…':'Refresh attendee check-ins'} disabled={loading} onPress={()=>void reload()}/>
 </View>
}
