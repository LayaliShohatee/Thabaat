import { useRef, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { brand } from '@/constants/brand'
import { checkInTicket, getAttendanceReport, type CheckInResult } from '@/services/ticketService'
import EventAttendanceRoster from '@/components/EventAttendanceRoster'
import TicketCameraScanner from '@/components/TicketCameraScanner'
import { CheckinRoster } from '@/components/CheckinRoster'
import { createTicketScanGate } from '@/lib/ticket-scanner'
import { exportCsvFile } from '@/lib/csv-export'
import { csvCell } from '@/lib/staff-reporting'
import { ManagementButton as Button, ManagementLink as Link, managementStyles as styles } from '@/components/ManagementUI'

// Event check-in. Search a name and tap Check in; scanning a ticket QR is the backup.
export default function CheckInScreen(){
 const {eventId}=useLocalSearchParams<{eventId:string}>()
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<CheckInResult|null>(null)
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
  await run(async()=>{setResult(await checkInTicket(eventId,attempt.token));accepted=true;setRosterKey(k=>k+1)})
  scanGate.current.complete(accepted);setScannerPaused(accepted)
 }
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
    {result&&<View style={{gap:4}}><Text style={styles.heading}>{result.already_checked_in?'Already checked in':'Checked in'}</Text><Text style={styles.text}>{result.full_name} · {result.ticket_name} · {new Date(result.checked_in_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</Text><Link label="Scan next ticket" disabled={busy} onPress={nextTicket}/></View>}
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
