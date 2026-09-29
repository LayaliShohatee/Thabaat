import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getEventAttendees, type EventAttendees as Attendees } from '@/services/managementService'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'

export function EventAttendees({eventId}:{eventId:string}) {
 const [offset,setOffset]=useState(0)
 const load=useCallback(()=>getEventAttendees(eventId,offset),[eventId,offset])
 const {data,loading,error,reload}=useFocusResource(load,null as Attendees|null)
 return <View style={styles.card}>
  <Text style={styles.heading}>Attendees</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
  {loading?<Text style={styles.text}>Loading attendees…</Text>:!error&&data&&<>
   <Text style={styles.text}>{data.counts.confirmed} confirmed · {data.counts.pending} pending · {data.counts.cancelled} cancelled</Text>
   <Text style={styles.text}>Capacity: {data.capacity} · Checkout reservations: {data.reserved} · Event seats remaining: {Math.max(0,data.capacity-data.counts.confirmed-data.counts.pending-data.reserved)}</Text>
   {!data.counts.total&&<Text style={styles.text}>No registrations yet.</Text>}
   {data.attendees.map(attendee=><View key={attendee.registration_id}>
    <Text style={styles.heading}>{attendee.full_name||'Unnamed attendee'}</Text>
    <Text style={styles.text}>{attendee.ticket_name} · {attendee.status}</Text>
    <Text style={styles.text}>Registered {new Date(attendee.registered_at).toLocaleString()}</Text>
   </View>)}
   {data.counts.total>0&&<Text style={styles.text}>Showing {data.attendees.length?offset+1:0}–{offset+data.attendees.length} of {data.counts.total}</Text>}
  </>}
  {offset>0&&<Button label="Previous attendees" disabled={loading} onPress={()=>setOffset(Math.max(0,offset-50))}/>}
  {!error&&data&&offset+50<data.counts.total&&<Button label="Next attendees" disabled={loading} onPress={()=>setOffset(offset+50)}/>}
  <Button label="Refresh attendees" disabled={loading} onPress={()=>void reload()}/>
 </View>
}
