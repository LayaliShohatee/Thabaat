import { useCallback, useState } from 'react'
import { isDemoMode, presentDemoEvent } from '@/lib/demo-mode'
import { ScrollView, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import { brand, fonts } from '@/constants/brand'
import RegisteredEventActions from '@/components/events/RegisteredEventActions'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getMyTicket, type TicketCredential } from '@/services/ticketService'
import { formatEventTime } from '@/lib/event-time'
import { ManagementLink as Link, managementStyles as styles } from '@/components/ManagementUI'

// The ticket: event, time and a big QR code. The private code and transfer options stay out of the way.
export default function TicketScreen(){
 const {id}=useLocalSearchParams<{id:string}>()
 const load=useCallback(async()=>{const ticket=await getMyTicket(id);return isDemoMode?{...ticket,...presentDemoEvent({id:ticket.event_id,title:ticket.title,location:ticket.location})}:ticket},[id])
 const {data:ticket,loading,error,reload}=useFocusResource(load,null as TicketCredential|null,5000)
 const [showCode,setShowCode]=useState(false)
 const checkedIn=!!ticket?.checked_in_at
 return <><Stack.Screen options={{title: 'Your ticket'}}/><ScrollView style={styles.page} contentContainerStyle={[styles.content,{paddingTop:20}]}>
  {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
  {ticket&&!error&&<View style={[styles.card,{gap:14,padding:20}]}>
   <View style={{gap:4}}>
    <Text style={{fontFamily:fonts.headingHeavy,fontSize:22,color:brand.ink}}>{ticket.title}</Text>
    <Text style={{fontFamily:fonts.label,fontSize:15,color:brand.primary}}>{formatEventTime(ticket.event_date)}</Text>
    <Text style={styles.text}>{ticket.location} · {ticket.ticket_name}</Text>
   </View>
   <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={{alignSelf:'flex-start',overflow:'hidden',paddingVertical:5,paddingHorizontal:12,borderRadius:999,fontFamily:fonts.label,fontSize:13,
    color:checkedIn?brand.primaryDark:brand.inkMuted,backgroundColor:checkedIn?brand.primarySoft:brand.page}}>{checkedIn?`Checked in · ${formatEventTime(ticket.checked_in_at!,undefined,{hour:'numeric',minute:'2-digit'})}`:'Not checked in'}</Text>
   <View style={{alignItems:'center',paddingVertical:8}} accessibilityLabel="Ticket QR code"><QRCode value={ticket.token} size={240}/></View>
   <Text style={[styles.text,{textAlign:'center'}]}>Show this at the door.</Text>
   {!isDemoMode&&<View>
    <Link center label={showCode?'Hide private code':'Show private code'} color={brand.inkMuted} onPress={()=>setShowCode(!showCode)}/>
    {showCode&&<View style={{gap:6}}>
     <Text selectable style={[styles.text,{fontSize:13,textAlign:'center'}]}>{ticket.token}</Text>
     <Text style={[styles.text,{fontSize:13,textAlign:'center'}]}>Keep this private: anyone holding it can use your ticket. Cancelling makes it stop working.</Text>
    </View>}
   </View>}
  </View>}
  {ticket&&!error&&<RegisteredEventActions registrationId={ticket.registration_id} eventId={ticket.event_id}/>}
  {!isDemoMode&&<View style={[styles.card,{gap:4,paddingVertical:10}]}>
   <Link label="Transfer this ticket" disabled={loading} onPress={()=>router.push('/ticket-gifts')}/>
   <Text style={[styles.text,{fontSize:13}]}>The other person accepts within 24 hours, then this ticket moves to their account.</Text>
   <Link label="Gift a free ticket or view gifts" disabled={loading} onPress={()=>router.push('/ticket-gifts')}/>
  </View>}
  <Link center label={loading?'Refreshing…':'Refresh ticket'} color={brand.inkMuted} disabled={loading} onPress={()=>void reload()}/>
 </ScrollView></>
}
