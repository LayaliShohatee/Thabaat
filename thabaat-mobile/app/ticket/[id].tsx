import { useCallback } from 'react'
import { isDemoMode, presentDemoEvent } from '@/lib/demo-mode'
import { ScrollView, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import RegisteredEventActions from '@/components/events/RegisteredEventActions'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getMyTicket, type TicketCredential } from '@/services/ticketService'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
export default function TicketScreen(){
 const {id}=useLocalSearchParams<{id:string}>()
 const load=useCallback(async()=>{const ticket=await getMyTicket(id);return isDemoMode?{...ticket,...presentDemoEvent({id:ticket.event_id,title:ticket.title,location:ticket.location})}:ticket},[id])
 const {data:ticket,loading,error,reload}=useFocusResource(load,null as TicketCredential|null,5000)
 return <><Stack.Screen options={{title: 'Event ticket'}}/><ScrollView style={styles.page} contentContainerStyle={styles.content}><Text style={styles.title}>Event ticket</Text>{!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}{ticket&&!error&&<View style={styles.card}><Text style={styles.heading}>{ticket.title}</Text><Text style={styles.text}>{new Date(ticket.event_date).toLocaleString()} · {ticket.location}{ '\n'}{ticket.ticket_name}</Text><Text accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.text}>{ticket.checked_in_at?`Checked in ${new Date(ticket.checked_in_at).toLocaleString()}`:'Not checked in'}</Text><View style={{padding:20,backgroundColor:'white',alignItems:'center'}} accessibilityLabel="Ticket QR code"><QRCode value={ticket.token} size={220}/></View><Text style={styles.text}>{isDemoMode?'Show this QR at event check-in.':'Show this QR at event check-in. Keep your private ticket code secure; anyone holding it can present your ticket.'}</Text>{!isDemoMode&&<Text selectable style={styles.text}>{ticket.token}</Text>}{!isDemoMode&&<Text style={styles.text}>Cancellation invalidates this code. Refresh after any registration change.</Text>}</View>}{ticket&&!error&&<RegisteredEventActions registrationId={ticket.registration_id} eventId={ticket.event_id}/>}{!isDemoMode&&<Button label="Gift a free ticket or view gifts" disabled={loading} onPress={()=>router.push('/ticket-gifts')}/>}<Button label={loading?'Refreshing…':'Refresh ticket'} disabled={loading} onPress={()=>void reload()}/></ScrollView></>
}
