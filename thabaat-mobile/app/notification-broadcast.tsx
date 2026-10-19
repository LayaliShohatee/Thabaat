import {useEffect,useState} from 'react'
import {ScrollView,Text,TextInput,View,Switch,Button,StyleSheet} from 'react-native'
import {supabase} from '@/lib/supabase'
import {notificationCategories} from '@/lib/notification-preferences'
import {reviewBroadcast,queueBroadcast,newBroadcastId,type BroadcastDraft} from '@/services/broadcastService'
import { brand } from '@/constants/brand'
export default function BroadcastScreen(){
 const [allowed,setAllowed]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[count,setCount]=useState<number|null>(null),[requestId,setRequestId]=useState<string|null>(null)
 const [draft,setDraft]=useState<BroadcastDraft>({category:'conferences',eventId:null,membersOnly:false,volunteerOnly:false,title:'',body:''})
 useEffect(()=>{let active=true;supabase.rpc('my_permissions').then(({data,error})=>{if(active){setAllowed(!error&&data?.staff_role==='admin');setLoading(false);if(error)setMessage('Unable to verify administrator access.')}});return()=>{active=false}},[])
 function change(value:Partial<BroadcastDraft>){setDraft({...draft,...value});setCount(null);setRequestId(null);setMessage('')}
 async function review(){setBusy(true);setMessage('');try{const total=await reviewBroadcast(draft);setRequestId(await newBroadcastId());setCount(total)}catch(e){setMessage(e instanceof Error?e.message:'Review unavailable.')}finally{setBusy(false)}}
 async function queue(){if(count===null||busy||!requestId)return;setBusy(true);setMessage('');try{
  const id=requestId
  const queued=await queueBroadcast(id,draft);setMessage(`${queued} notification jobs queued. This does not mean sent or delivered.`);setCount(null)
 }catch(e){setMessage(e instanceof Error?e.message:'Queue failed. Retry with this same draft.')}finally{setBusy(false)}}
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><Text style={styles.title}>Announcement broadcast</Text>
 {loading?<Text style={styles.text}>Checking administrator access…</Text>:!allowed?<Text style={styles.text}>Administrator access required.</Text>:<>
 <Text style={styles.text}>Only accounts opted into this category and push are eligible. Review selects a count; queue checks consent again. No recipient identities are exposed.</Text>
 {notificationCategories.map(category=><Button key={category} title={`${category===draft.category?'✓ ':''}${category.replaceAll('_',' ')}`} disabled={busy} onPress={()=>change({category})}/>)}
 <TextInput accessibilityLabel="Broadcast event ID" placeholder="Optional registered event UUID" placeholderTextColor="#abb" style={styles.input} value={draft.eventId??''} editable={!busy} onChangeText={value=>change({eventId:value.trim()||null})}/>
 <View style={styles.row}><Text style={styles.text}>Verified active members only</Text><Switch accessibilityLabel="Verified active members only" value={draft.membersOnly} disabled={busy} onValueChange={value=>change({membersOnly:value})}/></View>
 <View style={styles.row}><Text style={styles.text}>Assigned volunteers for selected event only</Text><Switch accessibilityLabel="Assigned volunteers for selected event only" value={draft.volunteerOnly} disabled={busy} onValueChange={value=>change({volunteerOnly:value})}/></View>
 <TextInput accessibilityLabel="Broadcast title" placeholder="Announcement title" placeholderTextColor="#abb" style={styles.input} maxLength={100} value={draft.title} editable={!busy} onChangeText={value=>change({title:value})}/>
 <TextInput accessibilityLabel="Broadcast message" placeholder="Message" placeholderTextColor="#abb" style={styles.input} multiline maxLength={1000} value={draft.body} editable={!busy} onChangeText={value=>change({body:value})}/>
 <Button title="Review eligible audience" disabled={busy||draft.title.trim().length<3||draft.body.trim().length<3} onPress={()=>void review()}/>
 {count!==null?<><Text style={styles.text}>Review: {count} eligible accounts. Category: {draft.category}. {draft.membersOnly?'Verified active members.':'All eligible members and free accounts.'} {draft.volunteerOnly?'Active assigned event volunteers.':draft.eventId?'Registered event attendees.':'Across events.'}</Text><Text style={styles.text}>{draft.title}{'\n'}{draft.body}</Text><Button title="Queue reviewed announcement" disabled={busy||count===0} onPress={()=>void queue()}/></>:null}
 </>}{message?<Text accessibilityRole="alert" style={styles.text}>{message}</Text>:null}</ScrollView>
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor: brand.ink},content:{padding:24,gap:14},title:{fontSize:27,color: brand.page,fontWeight:'bold'},text:{color: brand.line,lineHeight:22},input:{borderWidth:1,borderColor:'#85998d',borderRadius:8,padding:12,color: brand.page},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}})
