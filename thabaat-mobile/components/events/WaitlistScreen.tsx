import { useCallback, useState } from 'react'
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { brand, fonts } from '@/constants/brand'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getEventById } from '@/services/eventService'
import { getOwnWaitlist, getManagedWaitlist, joinWaitlist, leaveWaitlist, acceptWaitlist, offerWaitlist } from '@/services/waitlistService'
export default function WaitlistScreen({manage=false}:{manage?:boolean}) {
 const {eventId}=useLocalSearchParams<{eventId:string}>(); const {user}=useAuth()
 const [ticketId,setTicketId]=useState('');const [expiry,setExpiry]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{
  if(!user||!eventId)throw new Error('Sign in and choose an event.')
  const event=await getEventById(eventId)
  const [own,entries]=await Promise.all([getOwnWaitlist(eventId,user.id),manage?getManagedWaitlist(eventId):Promise.resolve([])])
  return {event,own,entries,now:Date.now()}
 },[eventId,user,manage])
 const {data,loading,error,reload}=useFocusResource(load,null)
 const tickets=data?.event?.ticket_types.filter(t=>Number(t.price)===0)??[]
 const selected=tickets.find(t=>t.id===ticketId)??tickets[0]
 const button=(label:string,onPress:()=>void,disabled=false)=><PressableScale key={label} accessibilityRole="button" disabled={disabled||busy} onPress={onPress} style={[styles.button,(disabled||busy)&&{opacity:.5}]}><Text style={styles.buttonText}>{label}</Text></PressableScale>
 async function run(action:()=>Promise<unknown>,message:string){if(busy)return;setBusy(true);setNotice('');try{await action();setNotice(message);await reload()}catch(e){setNotice(e instanceof Error?e.message:typeof e==='object'&&e&&'message'in e?String(e.message):'Request failed. Refresh and retry.')}finally{setBusy(false)}}
 const own=data?.own
 const offered=own?.status==='offered'&&Date.parse(own.offer_expires_at||'')>(data?.now??0)
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.title}>{manage?'Manage waitlist':'Event waitlist'}</Text>
  <Text style={styles.text}>{data?.event?.title||'Event'}</Text>
  <Text style={styles.text}>Free tickets only. Joining does not issue a ticket. A seat offer reserves one place until its stated expiry; acceptance rechecks event and membership eligibility.</Text>
  {loading&&<Text style={styles.text}>Loading…</Text>}{Boolean(error)&&<Text accessibilityRole="alert" style={styles.text}>{error}</Text>}{Boolean(notice)&&<Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}
  {!error&&data&&<>
   {!manage&&own&&<View style={styles.card}><Text style={styles.text}>Status: {offered?'Seat offered':own.status==='offered'?'Offer expired':own.status}</Text>{own.offer_expires_at&&<Text style={styles.text}>Offer expires: {new Date(own.offer_expires_at).toLocaleString()}</Text>}
    {offered&&button('Accept seat offer',()=>void run(()=>acceptWaitlist(eventId),'Seat accepted. Your ticket is in Events → My tickets.'))}
    {['waiting','offered'].includes(own.status)&&button('Leave waitlist',()=>void run(()=>leaveWaitlist(eventId),'Left the waitlist. Any reserved seat was released.'))}
    {own.status==='accepted'&&button('View my tickets',()=>router.push('/(tabs)/events?view=tickets'))}
   </View>}
   <Text style={styles.text}>Choose free ticket</Text>{tickets.map(t=>button(`${selected?.id===t.id?'● ':''}${t.name}`,()=>setTicketId(t.id)))}
   {!manage&&(!own||own.status==='left'||(own.status==='offered'&&!offered))&&button('Join waitlist',()=>void run(()=>joinWaitlist(eventId,selected!.id),'Joined waitlist. Refresh here to check for a seat offer.'),!selected)}
   {manage&&<>
    <Text style={styles.text}>Offer expiry in your local time (example: 2026-10-10T18:00). It must be before the event and within seven days.</Text><TextInput accessibilityLabel="Seat offer expiry" value={expiry} onChangeText={setExpiry} autoCapitalize="none" style={styles.input}/>
    {button('Offer seat to next eligible attendee',()=>void run(()=>{const date=new Date(expiry);if(!Number.isFinite(date.getTime()))throw new Error('Enter a valid offer expiry.');return offerWaitlist(eventId,selected!.id,date.toISOString())},'Seat offered to the next eligible waiting attendee.'),!selected||!expiry)}
    {data.entries.map(entry=><View key={entry.id} style={styles.card}><Text style={styles.text}>{entry.full_name||'Attendee'} · {entry.ticket_name}</Text><Text style={styles.text}>{entry.status} · Joined {new Date(entry.joined_at).toLocaleString()}</Text>{entry.offer_expires_at&&<Text style={styles.text}>Offer expires {new Date(entry.offer_expires_at).toLocaleString()}</Text>}</View>)}
    {!data.entries.length&&<Text style={styles.text}>No waitlist entries.</Text>}
   </>}
  </>}
  {button(busy?'Please wait…':'Refresh waitlist',()=>void reload(),loading)}
 </ScrollView>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor: brand.ink},content:{padding:24,gap:12},title:{color: brand.page,fontSize:24,fontFamily: fonts.heading},text:{color:'#ddd',lineHeight:22},card:{backgroundColor:'#202720',padding:16,gap:8,borderRadius:8},button:{backgroundColor: brand.line,padding:12,borderRadius:8},buttonText:{color:'#152019',fontWeight:'600'},input:{color: brand.page,borderWidth:1,borderColor:'#666',padding:12,borderRadius:8}})
