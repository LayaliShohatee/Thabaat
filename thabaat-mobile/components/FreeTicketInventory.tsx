import { useCallback,useRef,useState } from 'react'
import { Text,TextInput,View } from 'react-native'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getTicketInventory,saveTicket,setTicketCategory,type InventoryTicket } from '@/services/ticketInventoryService'
import { parseTicketPrice } from '@/lib/billing'
import { TICKET_CATEGORIES,categoryLabel,type TicketCategory } from '@/lib/ticket-categories'
import { isoToWallTime, wallTimeToIso, formatEventTime, type WallTime } from '@/lib/event-time'
import { DateTimeField } from './DateTimeField'
import { ManagementButton as Button,ManagementChip as Chip,ManagementLink as Link,managementStyles as styles } from './ManagementUI'
const blank={id:null as string|null,name:'',description:'',quantity:'50',price:'0',category:'general' as TicketCategory,sale_ends:null as WallTime|null}
// Ticket types for one event. Event capacity still caps total bookings across all ticket types.
export function FreeTicketInventory({eventId}:{eventId:string}) {
 const load=useCallback(()=>getTicketInventory(eventId),[eventId]);const {data,error,loading,reload}=useFocusResource(load,[] as InventoryTicket[])
 const [form,setForm]=useState<typeof blank|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const locked=useRef(false)
 async function save(){
  if(!form||locked.current)return
  const quantity=Number(form.quantity)
  if(!Number.isInteger(quantity)||quantity<0||quantity>10000||form.name.trim().length<2){setMessage('Enter a ticket name and a whole-number quantity from 0 to 10000.');return}
  const price=parseTicketPrice(form.price)
  if(price===null){setMessage('Enter a price in dollars from 0 to 10000, like 5 or 12.50. Use 0 for a free ticket.');return}
  if(form.category==='early_bird'&&!form.sale_ends){setMessage('Early bird tickets need a sales end time.');return}
  locked.current=true;setBusy(true)
  try{const id=await saveTicket(eventId,{...form,quantity,price});await setTicketCategory(id||form.id!,form.category,form.sale_ends?wallTimeToIso(form.sale_ends):null);setForm(null);setMessage('Ticket saved.');await reload()}
  catch(e){setMessage(e instanceof Error?e.message:'Unable to save ticket')}finally{locked.current=false;setBusy(false)}
 }
 return <View style={styles.card}>
  <Text style={styles.heading}>Ticket types</Text>
  {!!(error||message)&&<Text accessibilityRole="alert" style={styles.alert}>{error||message}</Text>}
  {!data.length&&<Text style={styles.text}>{loading?'Loading tickets…':'No ticket types yet.'}</Text>}
  {data.map(t=><View key={t.id} style={{gap:2,paddingVertical:8,borderTopWidth:1,borderColor:brand.line}}>
   <View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><Text style={{fontFamily:fonts.heading,color:brand.ink,fontSize:15,flexShrink:1}}>{t.name}</Text><Text style={{fontFamily:fonts.label,color:brand.primary}}>{Number(t.price)===0?'Free':`$${Number(t.price).toFixed(2)}`}</Text></View>
   <Text style={styles.text}>{categoryLabel(t.category)} · {t.reserved} of {t.quantity} taken{t.sale_ends_at?` · sales end ${formatEventTime(t.sale_ends_at)}`:''}</Text>
   <Link label="Edit" disabled={busy} onPress={()=>setForm({id:t.id,name:t.name,description:t.description||'',quantity:String(t.quantity),price:String(Number(t.price)),category:t.category||'general',sale_ends:t.sale_ends_at?isoToWallTime(t.sale_ends_at):null})}/>
  </View>)}
  {!form&&<Button label="+ Add ticket type" disabled={busy} onPress={()=>setForm({...blank})}/>}
  {form&&<View style={{gap:10}}>
   <TextInput accessibilityLabel="Ticket name" placeholder="Name (e.g. Women’s tickets 21+)" value={form.name} onChangeText={name=>setForm({...form,name})} style={styles.input}/>
   <TextInput accessibilityLabel="Ticket description" placeholder="Description (optional)" value={form.description} onChangeText={description=>setForm({...form,description})} style={styles.input} multiline/>
   <TextInput accessibilityLabel="Ticket quantity" placeholder="How many" value={form.quantity} onChangeText={quantity=>setForm({...form,quantity:quantity.replace(/\D/g,'')})} style={styles.input} keyboardType="number-pad"/>
   <Text style={[styles.text,{color:brand.ink,fontFamily:fonts.label}]}>Price (USD, 0 = free)</Text>
   <TextInput accessibilityLabel="Ticket price in dollars" placeholder="0" value={form.price} onChangeText={price=>setForm({...form,price})} style={styles.input} keyboardType="decimal-pad"/>
   {Number(parseTicketPrice(form.price))>0&&<Text style={styles.text}>Buyers pay this at checkout, one ticket at a time. Test payments only for now: no money is charged. The price locks once someone books this ticket.</Text>}
   <Text style={[styles.text,{color:brand.ink,fontFamily:fonts.label}]}>Category</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{TICKET_CATEGORIES.map(c=><Chip key={c} label={categoryLabel(c)} selected={form.category===c} disabled={busy} onPress={()=>setForm({...form,category:c})}/>)}</View>
   <DateTimeField label={form.category==='early_bird'?'Sales end':'Sales end (optional)'} value={form.sale_ends} onChange={sale_ends=>setForm({...form,sale_ends})} optional/>
   <Button label={busy?'Saving…':'Save ticket'} disabled={busy} onPress={()=>void save()}/>
   <Link label="Cancel" color={brand.inkMuted} disabled={busy} onPress={()=>setForm(null)}/>
  </View>}
 </View>
}
