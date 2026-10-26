import { useRef, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { brand } from '@/constants/brand'
import { checkInParty, getAttendanceReport, type PartyCheckIn } from '@/services/ticketService'
import EventAttendanceRoster from '@/components/EventAttendanceRoster'
import TicketCameraScanner from '@/components/TicketCameraScanner'
import { CheckinRoster } from '@/components/CheckinRoster'
import { createTicketScanGate } from '@/lib/ticket-scanner'
import { exportCsvFile } from '@/lib/csv-export'
import { csvCell } from '@/lib/staff-reporting'
import { ManagementButton as Button, ManagementLink as Link, managementStyles as styles } from '@/components/ManagementUI'

// Event check-in. Search a name and tap Check in; scanning a ticket QR is the backup.
// A scan shows every ticket the account holds for this event; a lone ticket is checked in straight away.
export default function CheckInScreen(){
 const {eventId}=useLocalSearchParams<{eventId:string}>()
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<PartyCheckIn|null>(null)
 const [showScanner,setShowScanner]=useState(false),[showNoShows,setShowNoShows]=useState(false),[rosterKey,setRosterKey]=useState(0)
 const locked=useRef(false),scanGate=useRef(createTicketScanGate())
 const [scannerPaused,setScannerPaused]=useState(false)
 async function run(action:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);setMessage('');try{await action()}catch(e){setResult(null);setMessage(e instanceof Error?e.message:'Check-in failed')}finally{locked.current=false;setBusy(false)}}
 async function validate(value:string){
  if(locked.current)return
  const attempt=scanGate.current.accept(value)
  if(attempt.status==='ignored')return
  if(attempt.status==='invalid'){setResult(null);setMessage('This is not a Thabaat ticket code. Scan the attendee ticket QR or enter its 64-character private code.');return}
  setToken(attempt.token);setScannerPaused(true)
  let accepted=false
  await run(async()=>{
   let party=await checkInParty(eventId,attempt.token,[])
   if(party.tickets.length===1&&!party.tickets[0].checked_in_at)party=await checkInParty(eventId,attempt.token)
   setResult(party);accepted=true;setRosterKey(k=>k+1)
  })
  scanGate.current.complete(accepted);setScannerPaused(accepted)
 }
 const checkIn=(ids?:string[])=>void run(async()=>{setResult(await checkInParty(eventId,token,ids));setRosterKey(k=>k+1)})
 function nextTicket(){if(locked.current)return;if(scanGate.current.reset()){setToken('');setResult(null);setMessage('');setScannerPaused(false)}}
 async function exportReport(){const data=await getAttendanceReport(eventId);const csv=[['Registration ID','Name','Status','Checked in at','No-show'],...data.attendees.map(r=>[r.registration_id,r.full_name,r.status,r.checked_in_at||'',r.no_show?'yes':'no'])].map(row=>row.map(csvCell).join(',')).join('\r\n');await exportCsvFile(csv,'thabaat-attendance.csv','Event attendance report');setMessage('Attendance CSV prepared from current server data.')}
 return <><Stack.Screen options={{title:'Check-in'}}/><ScrollView style={styles.page} contentContainerStyle={[styles.content,{paddingTop:20}]} keyboardShouldPersistTaps="handled">
  <CheckinRoster key={rosterKey} eventId={eventId}/>
  <View style={styles.card}>
   <Link label={showScanner?'Hide ticket scanner':'Scan a ticket QR instead'} onPress={()=>{setShowScanner(!showScanner);nextTicket()}}/>
   {showScanner&&<>
    <TicketCameraScanner paused={busy||scannerPaused} onScan={value=>{void validate(value)}}/>
    <TextInput accessibilityLabel="Ticket code" style={styles.input} value={token} onChangeText={value=>{if(busy)return;scanGate.current.reset();setToken(value);setResult(null);setMessage('');setScannerPaused(false)}} editable={!busy} autoCapitalize="none" autoCorrect={false} placeholder="Or type the 64-character ticket code"/>
    <Button label={busy?'Checking in…':result?'Ticket checked — scan next':'Check in this ticket'} disabled={busy||!!result||!token.trim()} onPress={()=>{void validate(token)}}/>
    {result&&<View style={{gap:8}}>
     <Text style={styles.heading}>{result.tickets.length>1?`${result.account_name}’s booking · ${result.tickets.length} tickets`:result.tickets[0]?.just_checked_in?'Checked in':'Already checked in'}</Text>
     {result.tickets.map(t=><View key={t.registration_id} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <Text style={[styles.text,{flex:1}]}>{t.full_name} · {t.ticket_name}</Text>
      {t.checked_in_at?<Text style={[styles.text,{color:t.just_checked_in?brand.primaryDark:brand.inkMuted}]}>{t.just_checked_in?'Checked in':'Already in'} · {new Date(t.checked_in_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</Text>
       :<Link label="Check in" disabled={busy} onPress={()=>checkIn([t.registration_id])}/>}
     </View>)}
     {result.tickets.filter(t=>!t.checked_in_at).length>1&&<Button label={busy?'Checking in…':`Check in all (${result.tickets.filter(t=>!t.checked_in_at).length})`} disabled={busy} onPress={()=>checkIn()}/>}
     <Link label="Scan next ticket" disabled={busy} onPress={nextTicket}/>
    </View>}
   </>}
   {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  </View>
  <View style={{gap:4}}>
   <Link label={showNoShows?'Hide no-show tools (event manager)':'Mark no-shows (event manager)'} color={brand.inkMuted} disabled={busy} onPress={()=>setShowNoShows(!showNoShows)}/>
   {showNoShows&&<EventAttendanceRoster eventId={eventId}/>}
   <Link label="Export attendance CSV (event manager)" color={brand.inkMuted} disabled={busy} onPress={()=>void run(exportReport)}/>
  </View>
 </ScrollView></>
}
