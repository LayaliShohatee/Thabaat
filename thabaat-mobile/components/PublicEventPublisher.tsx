import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { publishPublicEvent } from '@/services/backlogService'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'
// #117 Administrators choose exactly what a public (signed-out) event page shows.
export function PublicEventPublisher({event}:{event:{id:string;title:string;description?:string|null;location:string;members_only?:boolean}}) {
 const [title,setTitle]=useState(event.title),[summary,setSummary]=useState(event.description??''),[venue,setVenue]=useState(event.location)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function save(visible:boolean){if(busy)return;setBusy(true);setMessage('');try{await publishPublicEvent(event.id,title,summary,venue,visible);setMessage(visible?'Public page is live. Shared web links now open it.':'Public page hidden.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to update public page')}finally{setBusy(false)}}
 if(event.members_only)return <View style={styles.card}><Text style={styles.text}>Members-only events cannot have a public page.</Text></View>
 return <View style={styles.card}>
  <Text style={styles.heading}>Public page</Text>
  <Text style={styles.text}>Only these reviewed fields are shown to people who are not signed in.</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  <TextInput accessibilityLabel="Public title" style={styles.input} value={title} onChangeText={setTitle} placeholder="Public title"/>
  <TextInput accessibilityLabel="Public summary" style={styles.input} value={summary} onChangeText={setSummary} placeholder="Public summary" multiline/>
  <TextInput accessibilityLabel="Public venue" style={styles.input} value={venue} onChangeText={setVenue} placeholder="Venue label"/>
  <Button label={busy?'Saving…':'Publish public page'} disabled={busy} onPress={()=>void save(true)}/>
  <Button label="Hide public page" disabled={busy} onPress={()=>void save(false)}/>
 </View>
}
