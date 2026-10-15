import {useRef,useState} from 'react'
import {Text,TouchableOpacity,View,StyleSheet} from 'react-native'
import {eventShareLink} from '@/lib/event-sharing'
import {shareEventLink} from '@/services/eventShareService'
import { brand } from '@/constants/brand'
export default function EventShareActions({eventId}:{eventId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const inFlight=useRef(false)
 let link:{url:string;webFallback:boolean}|null=null
 let error=''
 try{link=eventShareLink(eventId,process.env.EXPO_PUBLIC_EVENT_WEB_ORIGIN)}catch(e){error=e instanceof Error?e.message:'Unable to create share link.'}
 async function share(){if(!link||inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('');try{setMessage(await shareEventLink(link.url))}catch(e){setMessage(e instanceof Error?e.message:'Unable to share.')}finally{inFlight.current=false;setBusy(false)}}
 return<View style={styles.container}><Text style={styles.heading}>Share this event</Text><Text style={styles.note}>{link?.webFallback?'The web event page requires sign-in. Opening directly in the installed app still needs approved domain association.':'App-only link: the Thabaat app must be installed. A browser fallback is awaiting the approved sharing website.'}</Text>
 {error?<Text style={styles.note}>{error}</Text>:<><Text selectable style={styles.link}>{link?.url}</Text><TouchableOpacity accessibilityRole="button" accessibilityState={{disabled:busy}} disabled={busy} style={styles.button} onPress={()=>void share()}><Text style={styles.label}>{busy?'Please wait…':'Share event link'}</Text></TouchableOpacity></>}
 {message?<Text accessibilityRole="alert" style={styles.note}>{message}</Text>:null}</View>
}
const styles=StyleSheet.create({container:{gap:8,marginBottom:20},heading:{color: brand.page,fontSize:18,fontWeight:'600'},note:{color: brand.inkMuted,lineHeight:20},link:{color:'#9fcbb3'},button:{padding:13,borderWidth:1,borderColor:'#666',borderRadius:8},label:{color: brand.page,textAlign:'center'}})
