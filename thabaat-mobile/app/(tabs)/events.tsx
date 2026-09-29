import { useCallback, useRef, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getPermissions,getManagementEvents,saveEvent,archiveEvent,type ManagedEvent,type Permissions } from '@/services/managementService'
import { ManagementButton as Button,managementStyles as styles } from '@/components/ManagementUI'
const blank={id:null as string|null,title:'',description:'',date:'',location:'',capacity:'50'}
export default function EventsTab() {
 const load=useCallback(async()=>{const events=await getManagementEvents();try{return {events,permissions:await getPermissions(),setupError:''}}catch(e){return {events,permissions:null,setupError:e instanceof Error?e.message:'Unable to load permissions'}}},[])
 const {data,loading,error,reload}=useFocusResource(load,{events:[] as ManagedEvent[],permissions:null as Permissions|null,setupError:''})
 const [search,setSearch]=useState(''),[form,setForm]=useState<typeof blank|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[archiveId,setArchiveId]=useState<string|null>(null)
 const locked=useRef(false)
 const canEdit=(event:ManagedEvent)=>data.permissions?.can_manage_events && (data.permissions.staff_role==='admin'||event.created_by===data.permissions.user_id)
 async function mutate(action:()=>Promise<unknown>,success:string) {if(locked.current)return;locked.current=true;setBusy(true);setMessage('');try{await action();setMessage(success);setForm(null);setArchiveId(null);await reload()}catch(e){setMessage(e instanceof Error?e.message:'Unable to save')}finally{locked.current=false;setBusy(false)}}
 function save() {
  if(!form)return
  const date=new Date(form.date),capacity=Number(form.capacity)
  if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()||!Number.isInteger(capacity)||capacity<1||capacity>10000){setMessage('Enter a future date/time and whole-number capacity from 1 to 10000.');return}
  void mutate(()=>saveEvent({...form,date:date.toISOString(),capacity}),'Event saved.')
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Text style={styles.title}>Events</Text><Text style={styles.text}>Browse events. Organizers manage events they create; administrators manage all events.</Text>
  <TextInput accessibilityLabel="Search events" placeholder="Search title or location" value={search} onChangeText={setSearch} style={styles.input}/>
  {!!(error||data.setupError)&&<Text accessibilityRole="alert" style={styles.alert}>{error||data.setupError}</Text>}
  {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  {data.permissions?.can_manage_events&&!form&&<Button label="Create free event" disabled={busy} onPress={()=>{setForm({...blank});setMessage('')}}/>}
  {form&&<View style={styles.card}><Text style={styles.heading}>{form.id?'Edit event':'New free event'}</Text><Text style={styles.text}>New events include a free General admission ticket. Existing ticket prices and quantities are unchanged when editing event capacity.</Text>
   {(['title','description','date','location','capacity'] as const).map(field=><View key={field}><Text style={styles.text}>{field==='date'?'Date and time (example: 2026-10-20T18:30, your local time)':field.charAt(0).toUpperCase()+field.slice(1)}</Text><TextInput accessibilityLabel={`Event ${field}`} value={form[field]} onChangeText={value=>setForm({...form,[field]:value})} style={styles.input} multiline={field==='description'} keyboardType={field==='capacity'?'number-pad':'default'} autoCapitalize={field==='date'?'none':'sentences'}/></View>)}
   <Button label={busy?'Saving…':'Save event'} disabled={busy} onPress={save}/><Button label="Discard edits" disabled={busy} onPress={()=>setForm(null)}/>
  </View>}
  {data.events.filter(e=>`${e.title} ${e.location}`.toLowerCase().includes(search.toLowerCase())).map(event=><View key={event.id} style={styles.card}>
   <Text style={styles.heading}>{event.title}</Text><Text style={styles.text}>{new Date(event.event_date).toLocaleString()} · {event.location}</Text><Text style={styles.text}>Capacity: {event.capacity}</Text>
   <Button label={`View ${event.title}`} onPress={()=>router.push(`/event/${event.id}`)}/>
   {canEdit(event)&&<><Button label={`Edit ${event.title}`} disabled={busy} onPress={()=>{setForm({id:event.id,title:event.title,description:event.description||'',date:event.event_date,location:event.location,capacity:String(event.capacity||50)});setMessage('')}}/>
   <Button label={`Archive ${event.title}`} disabled={busy} onPress={()=>setArchiveId(event.id)}/>
   {archiveId===event.id&&<><Text style={styles.text}>Archive this event? It will disappear from event listings and close registration. Existing bookings must be resolved first.</Text><Button label="Confirm archive" disabled={busy} onPress={()=>void mutate(()=>archiveEvent(event.id),'Event archived.')}/><Button label="Keep event" disabled={busy} onPress={()=>setArchiveId(null)}/></>}</>}
  </View>)}
  {!loading&&!data.events.length&&<Text style={styles.text}>No events available.</Text>}
  <Button label={loading?'Refreshing…':'Refresh events'} disabled={loading||busy} onPress={()=>void reload()}/>
 </ScrollView>
}
