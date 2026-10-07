import {useCallback} from 'react'
import {Text,View} from 'react-native'
import {useFocusResource} from '@/hooks/useFocusResource'
import {getAttendanceReport, type AttendanceReport} from '@/services/ticketService'
import {ManagementButton as Button,managementStyles as styles} from '@/components/ManagementUI'
export default function EventAttendanceRoster({eventId}:{eventId:string}){
 const load=useCallback(()=>getAttendanceReport(eventId),[eventId])
 const {data,loading,error,reload}=useFocusResource(load,null as AttendanceReport|null,5000)
 return <View style={styles.card}><Text style={styles.heading}>Attendee check-ins</Text>
 {loading&&!data&&<Text style={styles.text}>Loading attendee check-ins…</Text>}
 {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
 {data&&!error&&<><Text style={styles.text}>{data.checked_in} checked in / {data.confirmed} confirmed</Text>
 {data.attendees.length===0&&<Text style={styles.text}>No attendees yet.</Text>}
 {data.attendees.map(row=><View key={row.registration_id}><Text style={styles.heading}>{row.full_name||'Attendee'}</Text><Text accessibilityLiveRegion="polite" style={styles.text}>{row.checked_in_at?`Checked in · ${new Date(row.checked_in_at).toLocaleString()}`:'Not checked in'}</Text><Text style={styles.text}>Booking: {row.status}</Text></View>)}
 </>}
 <Button label={loading?'Refreshing…':'Refresh attendee check-ins'} disabled={loading} onPress={()=>void reload()}/>
 </View>
}
