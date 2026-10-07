import { useCallback,useRef,useState } from 'react'
import { Text,TextInput,View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getTicketInventory,saveFreeTicket,type InventoryTicket } from '@/services/ticketInventoryService'
import { ManagementButton as Button,managementStyles as styles } from './ManagementUI'
const blank={id:null as string|null,name:'',description:'',quantity:'0'}
export function FreeTicketInventory({eventId}:{eventId:string}) {
 const load=useCallback(()=>getTicketInventory(eventId),[eventId]);const {data,error,loading,reload}=useFocusResource(load,[] as InventoryTicket[])
 const [form,setForm]=useState<typeof blank|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const locked=useRef(false)
 async function save(){if(!form||locked.current)return;const quantity=Number(form.quantity);if(!Number.isInteger(quantity)||quantity<0||quantity>10000||form.name.trim().length<2){setMessage('Enter a ticket name and whole-number quantity from 0 to 10000.');return}locked.current=true;setBusy(true);try{await saveFreeTicket(eventId,{...form,quantity});setForm(null);setMessage('Free ticket saved.');await reload()}catch(e){setMessage(e instanceof Error?e.message:'Unable to save ticket')}finally{locked.current=false;setBusy(false)}}
 return <View style={styles.card}><Text style={styles.heading}>Free ticket inventory</Text><Text style={styles.text}>Event capacity limits total bookings across ticket types. Quantity zero closes a ticket type once its reserved seats are resolved. Paid prices and discounts require the approved payment integration.</Text>{!!(error||message)&&<Text accessibilityRole="alert" style={styles.alert}>{error||message}</Text>}
 {data.map(t=><View key={t.id} style={{marginVertical:8}}><Text style={styles.text}>{t.name} · {t.price===0?'Free':'Paid'} · {t.reserved} reserved / {t.quantity}</Text>{t.price===0&&<Button label={`Edit ticket ${t.name}`} disabled={busy} onPress={()=>setForm({id:t.id,name:t.name,description:t.description||'',quantity:String(t.quantity)})}/>}</View>)}
 {!form&&<Button label="Add free ticket type" disabled={busy} onPress={()=>setForm({...blank})}/>}
 {form&&<View>{(['name','description','quantity'] as const).map(field=><TextInput key={field} accessibilityLabel={`Ticket ${field}`} placeholder={field} value={form[field]} onChangeText={value=>setForm({...form,[field]:value})} style={styles.input} multiline={field==='description'} keyboardType={field==='quantity'?'number-pad':'default'}/>)}<Button label={busy?'Saving ticket…':'Save free ticket'} disabled={busy} onPress={()=>void save()}/><Button label="Discard ticket edits" disabled={busy} onPress={()=>setForm(null)}/></View>}
 <Button label={loading?'Loading tickets…':'Refresh tickets'} disabled={busy||loading} onPress={()=>void reload()}/></View>
}
