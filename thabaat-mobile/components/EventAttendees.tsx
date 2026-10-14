import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getEventAttendees, type EventAttendees as Attendees } from '@/services/managementService'
import { AGE_FILTERS, GENDER_FILTERS, filterAttendees, genderLabel, type AgeFilter, type GenderFilter } from '@/lib/attendee-filters'
import { categoryLabel } from '@/lib/ticket-categories'
import { ManagementChip as Chip, ManagementLink as Link, managementStyles as styles } from './ManagementUI'

export function EventAttendees({eventId}:{eventId:string}) {
 const [offset,setOffset]=useState(0)
 const [gender,setGender]=useState<GenderFilter>('all'),[age,setAge]=useState<AgeFilter>('all')
 const load=useCallback(()=>getEventAttendees(eventId,offset),[eventId,offset])
 const {data,loading,error,reload}=useFocusResource(load,null as Attendees|null)
 const shown=data?filterAttendees(data.attendees,gender,age):[]
 return <View style={styles.card}>
  <Text style={styles.heading}>Attendees</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
  {loading?<Text style={styles.text}>Loading attendees…</Text>:!error&&data&&<>
   <Text style={styles.text}>{data.counts.confirmed} confirmed · {data.counts.pending} pending · {data.counts.cancelled} cancelled</Text>
   <Text style={styles.text}>Capacity: {data.capacity} · Checkout reservations: {data.reserved} · Event seats remaining: {Math.max(0,data.capacity-data.counts.confirmed-data.counts.pending-data.reserved)}</Text>
   {!data.counts.total&&<Text style={styles.text}>No registrations yet.</Text>}
   {data.counts.total>0&&<>
    <Text style={styles.text}>Filter by gender</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{GENDER_FILTERS.map(([value,label])=><Chip key={value} label={label} selected={gender===value} onPress={()=>setGender(value)}/>)}</View>
    <Text style={styles.text}>Filter by age</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{AGE_FILTERS.map(([value,label])=><Chip key={value} label={label} selected={age===value} onPress={()=>setAge(value)}/>)}</View>
    <Text style={styles.text}>Matching on this page: {shown.length} of {data.attendees.length}</Text>
   </>}
   {shown.map(attendee=><View key={attendee.registration_id}>
    <Text style={styles.heading}>{attendee.full_name||'Unnamed attendee'}</Text>
    <Text style={styles.text}>{attendee.ticket_name}{attendee.ticket_category&&attendee.ticket_category!=='general'?` (${categoryLabel(attendee.ticket_category)})`:''} · {attendee.status}</Text>
    <Text style={styles.text}>{genderLabel(attendee.gender)} · {attendee.age!=null?`Age ${attendee.age}`:'Age not shared'}</Text>
    <Text style={styles.text}>Registered {new Date(attendee.registered_at).toLocaleString()}</Text>
   </View>)}
   {data.counts.total>0&&<Text style={styles.text}>Showing {data.attendees.length?offset+1:0}–{offset+data.attendees.length} of {data.counts.total}</Text>}
  </>}
  {offset>0&&<Link label="Previous attendees" disabled={loading} onPress={()=>setOffset(Math.max(0,offset-50))}/>}
  {!error&&data&&offset+50<data.counts.total&&<Link label="Next attendees" disabled={loading} onPress={()=>setOffset(offset+50)}/>}
  <Link label="Refresh attendees" disabled={loading} onPress={()=>void reload()}/>
 </View>
}
