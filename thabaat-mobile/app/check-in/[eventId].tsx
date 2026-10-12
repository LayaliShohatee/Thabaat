import { useRef, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { checkInTicket, getAttendanceReport, type AttendanceReport, type CheckInResult } from '@/services/ticketService'
import EventAttendanceRoster from '@/components/EventAttendanceRoster'
import TicketCameraScanner from '@/components/TicketCameraScanner'
import { createTicketScanGate } from '@/lib/ticket-scanner'
import { exportCsvFile } from '@/lib/csv-export'
import { csvCell } from '@/lib/staff-reporting'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
export default function CheckInScreen(){
 const {eventId}=useLocalSearchParams<{eventId:string}>()
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<CheckInResult|null>(null),[report,setReport]=useState<AttendanceReport|null>(null)
 const [showRoster,setShowRoster]=useState(false)
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
  await run(async()=>{setResult(await checkInTicket(eventId,attempt.token));accepted=true})
  scanGate.current.complete(accepted);setScannerPaused(accepted)
 }
 function nextTicket(){if(locked.current)return;if(scanGate.current.reset()){setToken('');setResult(null);setMessage('');setScannerPaused(false)}}
 async function exportReport(){const data=await getAttendanceReport(eventId);setReport(data);const csv=[['Registration ID','Name','Status','Checked in at','No-show'],...data.attendees.map(r=>[r.registration_id,r.full_name,r.status,r.checked_in_at||'',r.no_show?'yes':'no'])].map(row=>row.map(csvCell).join(',')).join('\r\n');await exportCsvFile(csv,'thabaat-attendance.csv','Event attendance report');setMessage('Attendance CSV prepared from current server data.')}
 return <><Stack.Screen options={{title: 'Event check-in'}}/><ScrollView style={styles.page} contentContainerStyle={styles.content}><Text style={styles.title}>Event check-in</Text><Text style={styles.text}>Enter the private code shown below the attendee’s QR. Active event staff access and confirmed ticket status are checked by the server on every attempt.</Text><TicketCameraScanner paused={busy||scannerPaused} onScan={value=>{void validate(value)}}/><TextInput accessibilityLabel="Ticket code" style={styles.input} value={token} onChangeText={value=>{if(busy)return;scanGate.current.reset();setToken(value);setResult(null);setMessage('');setScannerPaused(false)}} editable={!busy} autoCapitalize="none" autoCorrect={false} placeholder="64-character private ticket code"/><Button label={busy?'Checking in…':result?'Ticket checked — scan next ticket':'Validate and check in'} disabled={busy||!!result||!token.trim()} onPress={()=>{void validate(token)}}/>{result&&<View style={styles.card}><Text style={styles.heading}>{result.already_checked_in?'Already checked in':'Checked in'}</Text><Text style={styles.text}>{result.full_name} · {result.ticket_name}{ '\n'}{new Date(result.checked_in_at).toLocaleString()}</Text><Text style={styles.text}>{result.already_checked_in?'Previous attendance retained; no duplicate check-in created.':'Attendance recorded.'}</Text><Button label="Scan next ticket" disabled={busy} onPress={nextTicket}/></View>}{!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}<Button label="View attendee check-ins (event manager)" disabled={busy} onPress={()=>setShowRoster(true)}/>{showRoster&&<EventAttendanceRoster eventId={eventId}/>}<Button label="Export attendance CSV (event manager)" disabled={busy} onPress={()=>void run(exportReport)}/>{report&&<View style={styles.card}><Text style={styles.heading}>{report.checked_in} checked in / {report.confirmed} confirmed</Text><Text style={styles.text}>Not yet checked in: {Math.max(0,report.confirmed-report.checked_in)} · Marked no-show: {report.no_shows??0}. Open the attendee check-ins list to mark individual no-shows after the event starts.</Text><Button label="Export attendance CSV" disabled={busy} onPress={()=>void run(exportReport)}/></View>}</ScrollView></>
}
