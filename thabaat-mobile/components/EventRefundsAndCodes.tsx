import { useCallback, useState } from 'react'
import { Switch, Text, TextInput, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { listPromoCodes, listRefundRequests, reviewRefundRequest, savePromoCode, setRefundDeadline, type PromoCode, type RefundRequest } from '@/services/refundDiscountService'
import { money } from '@/lib/billing'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'
const blank={id:null as string|null,code:'',kind:'percent' as 'percent'|'amount',value:'',max_uses:'',expires_at:'',active:true}
// Event-manager tools: refund deadline, refund request review and discount codes.
export function EventRefundsAndCodes({eventId,refundDeadline}:{eventId:string;refundDeadline?:string|null}) {
 const load=useCallback(async()=>{const [refunds,codes]=await Promise.all([listRefundRequests(eventId),listPromoCodes(eventId)]);return {refunds,codes}},[eventId])
 const {data,error,loading,reload}=useFocusResource(load,{refunds:[] as RefundRequest[],codes:[] as PromoCode[]})
 const [deadline,setDeadline]=useState(refundDeadline||''),[form,setForm]=useState<typeof blank|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function run(action:()=>Promise<unknown>,success:string){if(busy)return;setBusy(true);setMessage('');try{await action();setMessage(success);await reload()}catch(e){setMessage(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}}
 function saveDeadline(){const d=deadline.trim()?new Date(deadline):null;if(d&&!Number.isFinite(d.getTime())){setMessage('Enter the deadline like 2026-10-19T18:00.');return}void run(()=>setRefundDeadline(eventId,d?d.toISOString():null),d?'Refund deadline saved.':'Refund deadline cleared (refunds allowed until the event starts).')}
 function saveCode(){
  if(!form)return;const n=Number(form.value),max=form.max_uses.trim()?Number(form.max_uses):null,exp=form.expires_at.trim()?new Date(form.expires_at):null
  if(!(n>0)||(form.kind==='percent'&&(!Number.isInteger(n)||n>100))){setMessage(form.kind==='percent'?'Enter a whole percent from 1 to 100.':'Enter a dollar amount above 0.');return}
  if(max!==null&&(!Number.isInteger(max)||max<1)){setMessage('Use limit must be a whole number, or blank for unlimited.');return}
  if(exp&&!Number.isFinite(exp.getTime())){setMessage('Enter the expiry like 2026-10-19T18:00.');return}
  void run(async()=>{await savePromoCode(eventId,{id:form.id,code:form.code,percent_off:form.kind==='percent'?n:null,amount_off_cents:form.kind==='amount'?Math.round(n*100):null,max_uses:max,expires_at:exp?exp.toISOString():null,active:form.active});setForm(null)},'Discount code saved.')
 }
 return <View style={styles.card}>
  <Text style={styles.heading}>Refunds and discount codes</Text>
  {!!(error||message)&&<Text accessibilityRole="alert" style={styles.alert}>{error||message}</Text>}
  <Text style={styles.text}>Refund deadline (blank = until the event starts)</Text>
  <TextInput accessibilityLabel="Refund deadline" style={styles.input} value={deadline} onChangeText={setDeadline} placeholder="2026-10-19T18:00" autoCapitalize="none"/>
  <Button label="Save refund deadline" disabled={busy} onPress={saveDeadline}/>
  <Text style={styles.heading}>Refund requests</Text>
  {!data.refunds.length&&<Text style={styles.text}>{loading?'Loading…':'No refund requests.'}</Text>}
  {data.refunds.map(r=><View key={r.id}><Text style={styles.text}>{r.full_name} · {r.ticket_name} ({money(Math.round(r.price*100))}) · {r.status}{r.reason?`\nReason: ${r.reason}`:''}</Text>
   {r.status==='requested'&&<><Button label={`Approve refund for ${r.full_name}`} disabled={busy} onPress={()=>void run(()=>reviewRefundRequest(r.id,true,'Approved'),'Refund approved. Return the payment in CharityStack; the seat has been released.')}/><Button label={`Decline refund for ${r.full_name}`} disabled={busy} onPress={()=>void run(()=>reviewRefundRequest(r.id,false,'Declined'),'Refund declined.')}/></>}
  </View>)}
  <Text style={styles.heading}>Discount codes</Text>
  {data.codes.map(c=><View key={c.id}><Text style={styles.text}>{c.code} · {c.percent_off?`${c.percent_off}% off`:`${money(c.amount_off_cents||0)} off`} · used {c.uses}{c.max_uses?`/${c.max_uses}`:''}{c.expires_at?` · expires ${new Date(c.expires_at).toLocaleString()}`:''}{c.active?'':' · inactive'}{c.event_id?'':' · site-wide'}</Text>
   {c.event_id&&<Button label={`Edit code ${c.code}`} disabled={busy} onPress={()=>setForm({id:c.id,code:c.code,kind:c.percent_off?'percent':'amount',value:String(c.percent_off??(c.amount_off_cents||0)/100),max_uses:c.max_uses?String(c.max_uses):'',expires_at:c.expires_at||'',active:c.active})}/>}
  </View>)}
  {!form&&<Button label="Add discount code" disabled={busy} onPress={()=>setForm({...blank})}/>}
  {form&&<View>
   <TextInput accessibilityLabel="Discount code" style={styles.input} value={form.code} onChangeText={code=>setForm({...form,code:code.toUpperCase()})} placeholder="CODE (e.g. EARLY10)" autoCapitalize="characters"/>
   <View style={{flexDirection:'row',gap:8}}><Button label={`${form.kind==='percent'?'✓ ':''}Percent off`} onPress={()=>setForm({...form,kind:'percent'})}/><Button label={`${form.kind==='amount'?'✓ ':''}Dollars off`} onPress={()=>setForm({...form,kind:'amount'})}/></View>
   <TextInput accessibilityLabel="Discount value" style={styles.input} value={form.value} onChangeText={value=>setForm({...form,value})} placeholder={form.kind==='percent'?'Percent (1–100)':'Dollars off'} keyboardType="decimal-pad"/>
   <TextInput accessibilityLabel="Use limit" style={styles.input} value={form.max_uses} onChangeText={max_uses=>setForm({...form,max_uses})} placeholder="Use limit (blank = unlimited)" keyboardType="number-pad"/>
   <TextInput accessibilityLabel="Code expiry" style={styles.input} value={form.expires_at} onChangeText={expires_at=>setForm({...form,expires_at})} placeholder="Expires (optional, 2026-10-19T18:00)" autoCapitalize="none"/>
   <View><Text style={styles.text}>Active</Text><Switch accessibilityLabel="Discount code active" value={form.active} onValueChange={active=>setForm({...form,active})}/></View>
   <Button label={busy?'Saving…':'Save discount code'} disabled={busy} onPress={saveCode}/><Button label="Discard code edits" disabled={busy} onPress={()=>setForm(null)}/>
  </View>}
 </View>
}
