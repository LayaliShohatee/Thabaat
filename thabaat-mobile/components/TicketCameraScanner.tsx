import { useCallback, useRef, useState, type ComponentType } from 'react'
import { Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
type Props={paused:boolean;onScan:(data:string)=>void}
type PreviewProps=Props&{onClose:()=>void}
export default function TicketCameraScanner(props:Props) {
 const request=useRef(0)
 const [Preview,setPreview]=useState<ComponentType<PreviewProps>|null>(null),[message,setMessage]=useState(''),[loading,setLoading]=useState(false)
 // Never keep a preview alive when navigating away; only one camera session may be active.
 useFocusEffect(useCallback(()=>()=>{request.current++;setPreview(null);setLoading(false)},[]))
 async function open(){if(loading)return;const current=++request.current;setLoading(true);setMessage('');try{const module=await import('./TicketCameraPreview');if(current===request.current)setPreview(()=>module.default)}catch{if(current===request.current)setMessage('Camera scanning is unavailable in this app build. Use manual ticket entry below.')}finally{if(current===request.current)setLoading(false)}}
 return <View>{Preview?<Preview {...props} onClose={()=>setPreview(null)}/>:<Button label={loading?'Opening camera…':'Scan with camera'} disabled={loading} onPress={()=>{void open()}}/>}{!!message&&<Text style={styles.alert}>{message}</Text>}</View>
}
