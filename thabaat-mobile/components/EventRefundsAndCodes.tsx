import { useCallback, useState } from 'react'
import { Switch, Text, TextInput, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { brand, fonts } from '@/constants/brand'
import { useFocusResource } from '@/hooks/useFocusResource'
import { listPromoCodes, listRefundRequests, reviewRefundRequest, savePromoCode, setPromoCodeTicketType, setRefundDeadline, type PromoCode, type RefundRequest } from '@/services/refundDiscountService'
import { getTicketInventory, type InventoryTicket } from '@/services/ticketInventoryService'
import { money } from '@/lib/billing'
import { couponTicketLabel } from '@/lib/coupons'
import { formatEventTime, isoToWallTime, wallTimeToIso, type WallTime } from '@/lib/event-time'
import { DateTimeField } from './DateTimeField'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'
const blank={id:null as string|null,code:'',kind:'percent' as 'percent'|'amount',value:'',max_uses:'',expires:null as WallTime|null,active:true,ticket_type_id:null as string|null,saved_ticket_type_id:null as string|null}

// Event-manager tools: coupons (discount codes), then refund deadline and refund requests.
export function EventRefundsAndCodes({eventId,refundDeadline}:{eventId:string;refundDeadline?:string|null}) {
 const load=useCallback(async()=>{const [refunds,codes,tickets]=await Promise.all([listRefundRequests(eventId),listPromoCodes(eventId),getTicketInventory(eventId)]);return {refunds,codes,tickets}},[eventId])
 const {data,error,loading,reload}=useFocusResource(load,{refunds:[] as RefundRequest[],codes:[] as PromoCode[],tickets:[] as InventoryTicket[]})
 const [deadline,setDeadline]=useState<WallTime|null>(refundDeadline?isoToWallTime(refundDeadline):null),[form,setForm]=useState<typeof blank|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function run(action:()=>Promise<unknown>,success:string){if(busy)return;setBusy(true);setMessage('');try{await action();setMessage(success);await reload()}catch(e){setMessage(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}}
 function saveCode(){
  if(!form)return;const n=Number(form.value),max=form.max_uses.trim()?Number(form.max_uses):null
  if(!(n>0)||(form.kind==='percent'&&(!Number.isInteger(n)||n>100))){setMessage(form.kind==='percent'?'Enter a whole percent from 1 to 100.':'Enter a dollar amount above 0.');return}
  if(max!==null&&(!Number.isInteger(max)||max<1)){setMessage('Use limit must be a whole number, or blank for unlimited.');return}
  void run(async()=>{
   const id=await savePromoCode(eventId,{id:form.id,code:form.code,percent_off:form.kind==='percent'?n:null,amount_off_cents:form.kind==='amount'?Math.round(n*100):null,max_uses:max,expires_at:form.expires?wallTimeToIso(form.expires):null,active:form.active})
   if(form.ticket_type_id!==form.saved_ticket_type_id)await setPromoCodeTicketType(id||form.id!,form.ticket_type_id)
   setForm(null)
  },'Coupon saved.')
 }
 const pill=(label:string,selected:boolean,onPress:()=>void)=><PressableScale key={label} accessibilityRole="radio" accessibilityState={{selected}} onPress={onPress} style={{paddingVertical:8,paddingHorizontal:12,borderRadius:999,borderWidth:1,borderColor:selected?brand.primary:brand.line,backgroundColor:selected?brand.primarySoft:brand.card}}><Text style={{color:brand.ink,fontFamily:fonts.label,fontSize:14}}>{label}</Text></PressableScale>
 return <>
 {!!(error||message)&&<Text accessibilityRole="alert" style={styles.alert}>{error||message}</Text>}
 <View style={styles.card}>
  <Text style={styles.heading}>Coupons</Text>
  {!data.codes.length&&<Text style={styles.text}>{loading?'Loading…':'No coupons yet.'}</Text>}
  {data.codes.map(c=><View key={c.id} style={{gap:4,paddingVertical:8,borderTopWidth:1,borderColor:brand.line}}>
   <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontFamily:fonts.heading,color:brand.ink,fontSize:15}}>{c.code}</Text><Text style={{fontFamily:fonts.label,color:brand.primary}}>{c.percent_off?`${c.percent_off}% off`:`${money(c.amount_off_cents||0)} off`}</Text></View>
   <Text style={styles.text}>Applies to: {couponTicketLabel(c,data.tickets)}</Text>
   <Text style={styles.text}>Used {c.uses}{c.max_uses?` of ${c.max_uses}`:''}{c.expires_at?` · ends ${formatEventTime(c.expires_at)}`:''}{c.active?'':' · paused'}</Text>
   {c.event_id&&<PressableScale accessibilityRole="button" accessibilityLabel={`Edit coupon ${c.code}`} disabled={busy} onPress={()=>setForm({id:c.id,code:c.code,kind:c.percent_off?'percent':'amount',value:String(c.percent_off??(c.amount_off_cents||0)/100),max_uses:c.max_uses?String(c.max_uses):'',expires:c.expires_at?isoToWallTime(c.expires_at):null,active:c.active,ticket_type_id:c.ticket_type_id??null,saved_ticket_type_id:c.ticket_type_id??null})}><Text style={{color:brand.primary,fontFamily:fonts.label}}>Edit</Text></PressableScale>}
  </View>)}
  {!form&&<Button label="+ Add coupon" disabled={busy} onPress={()=>setForm({...blank})}/>}
  {form&&<View style={{gap:10}}>
   <TextInput accessibilityLabel="Coupon code" style={styles.input} value={form.code} onChangeText={code=>setForm({...form,code:code.toUpperCase()})} placeholder="CODE (e.g. SISTERS21)" autoCapitalize="characters"/>
   <View style={{flexDirection:'row',gap:8}}>{pill('Percent off',form.kind==='percent',()=>setForm({...form,kind:'percent'}))}{pill('Dollars off',form.kind==='amount',()=>setForm({...form,kind:'amount'}))}</View>
   <TextInput accessibilityLabel="Discount value" style={styles.input} value={form.value} onChangeText={value=>setForm({...form,value})} placeholder={form.kind==='percent'?'Percent (1–100)':'Dollars off'} keyboardType="decimal-pad"/>
   <Text style={[styles.text,{color:brand.ink,fontFamily:fonts.label}]}>Applies to</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{pill('All tickets',!form.ticket_type_id,()=>setForm({...form,ticket_type_id:null}))}{data.tickets.map(t=>pill(t.name,form.ticket_type_id===t.id,()=>setForm({...form,ticket_type_id:t.id})))}</View>
   <TextInput accessibilityLabel="Use limit" style={styles.input} value={form.max_uses} onChangeText={max_uses=>setForm({...form,max_uses})} placeholder="Use limit (blank = unlimited)" keyboardType="number-pad"/>
   <DateTimeField label="Coupon ends (optional)" value={form.expires} onChange={expires=>setForm({...form,expires})} optional/>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.text}>Active</Text><Switch accessibilityLabel="Coupon active" value={form.active} onValueChange={active=>setForm({...form,active})}/></View>
   <Button label={busy?'Saving…':'Save coupon'} disabled={busy} onPress={saveCode}/>
   <PressableScale accessibilityRole="button" onPress={()=>setForm(null)}><Text style={{color:brand.inkMuted,fontFamily:fonts.label,textAlign:'center'}}>Cancel</Text></PressableScale>
  </View>}
 </View>
 <View style={styles.card}>
  <Text style={styles.heading}>Refunds</Text>
  <DateTimeField label="Last day for refunds (blank = until the event starts)" value={deadline} onChange={setDeadline} optional/>
  <Button label="Save refund deadline" disabled={busy} onPress={()=>void run(()=>setRefundDeadline(eventId,deadline?wallTimeToIso(deadline):null),deadline?'Refund deadline saved.':'Refund deadline cleared (refunds allowed until the event starts).')}/>
  {!data.refunds.length&&<Text style={styles.text}>{loading?'Loading…':'No refund requests.'}</Text>}
  {data.refunds.map(r=><View key={r.id} style={{gap:6,paddingVertical:8,borderTopWidth:1,borderColor:brand.line}}><Text style={styles.text}>{r.full_name} · {r.ticket_name} ({money(Math.round(r.price*100))}) · {r.status}{r.reason?`\nReason: ${r.reason}`:''}</Text>
   {r.status==='requested'&&<><Button label={`Approve refund for ${r.full_name}`} disabled={busy} onPress={()=>void run(()=>reviewRefundRequest(r.id,true,'Approved'),'Refund approved. Return the payment in CharityStack; the seat has been released.')}/><Button label={`Decline refund for ${r.full_name}`} disabled={busy} onPress={()=>void run(()=>reviewRefundRequest(r.id,false,'Declined'),'Refund declined.')}/></>}
  </View>)}
 </View>
 </>
}
