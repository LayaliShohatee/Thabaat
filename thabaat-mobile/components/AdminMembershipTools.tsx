import { useCallback, useState } from 'react'
import { getPaymentsMode, setPaymentsMode, type PaymentsMode } from '@/services/sandboxPaymentService'
import { Switch, Text, TextInput, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { supabase } from '@/lib/supabase'
import { listMembershipChangeRequests, reviewMembershipChange, saveMembershipPlan, type MembershipChangeRequest } from '@/services/backlogService'
import { money, periodLabel, type Plan } from '@/lib/billing'
import { ManagementButton as Button, managementStyles as styles } from './ManagementUI'
type PlanRow=Plan&{ticket_discount_percent?:number}
const blank={id:null as string|null,name:'',description:'',benefits:'',amount:'',billing_period:'monthly' as Plan['billing_period'],checkout_url:'',published:false,discount:'0'}
const labels:Record<MembershipChangeRequest['kind'],string>={cancel_renewal:'Stop renewing',resume_renewal:'Keep renewing',change_plan:'Change plan'}
// #136 plan/tier management and #53–55 membership change review (administrators only).
export function AdminMembershipTools() {
 const load=useCallback(async()=>{const [plans,requests,mode]=await Promise.all([supabase.from('membership_plans').select('*').order('amount_cents'),listMembershipChangeRequests(),getPaymentsMode()]);if(plans.error)throw new Error(plans.error.message);return {plans:(plans.data||[]) as PlanRow[],requests,mode}},[])
 const {data,error,reload}=useFocusResource(load,{plans:[] as PlanRow[],requests:[] as MembershipChangeRequest[],mode:'off' as PaymentsMode})
 const [form,setForm]=useState<typeof blank|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function run(action:()=>Promise<unknown>,success:string){if(busy)return;setBusy(true);setMessage('');try{await action();setMessage(success);await reload()}catch(e){setMessage(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}}
 function save(){
  if(!form)return;const amount=form.amount.trim()?Math.round(Number(form.amount)*100):null,discount=Number(form.discount||0)
  if(amount!==null&&!(amount>0)){setMessage('Enter a price above $0, or leave it blank.');return}
  if(!Number.isInteger(discount)||discount<0||discount>100){setMessage('Ticket discount must be a whole percent from 0 to 100.');return}
  void run(async()=>{await saveMembershipPlan({id:form.id,name:form.name,description:form.description,benefits:form.benefits.split('\n').map(b=>b.trim()).filter(Boolean),amount_cents:amount,billing_period:form.billing_period,checkout_url:form.checkout_url.trim()||null,published:form.published,ticket_discount_percent:discount});setForm(null)},'Membership plan saved.')
 }
 return <View style={styles.card}>
  <Text style={styles.heading}>Test payments</Text>
  <Text style={styles.text}>Test mode lets members buy tickets and memberships and donate without real money, so every flow can be checked end to end. Keep it off for a live launch.</Text>
  <View><Text style={styles.text}>Test payments {data.mode==='sandbox'?'ON':'OFF'}</Text><Switch accessibilityLabel="Test payments mode" value={data.mode==='sandbox'} disabled={busy} onValueChange={on=>void run(()=>setPaymentsMode(on?'sandbox':'off'),on?'Test payments turned on.':'Test payments turned off.')}/></View>
  <Text style={styles.heading}>Membership tiers</Text>
  {!!(error||message)&&<Text accessibilityRole="alert" style={styles.alert}>{error||message}</Text>}
  {data.plans.map(p=><View key={p.id}><Text style={styles.text}>{p.name} · {p.amount_cents?`${money(p.amount_cents,p.currency)} ${periodLabel(p.billing_period)}`:'No price'} · {p.published?'Published':'Hidden'} · {p.ticket_discount_percent??0}% ticket discount</Text>
   {p.acquisition_mode!=='complimentary'&&<Button label={`Edit tier ${p.name}`} disabled={busy} onPress={()=>setForm({id:p.id,name:p.name,description:p.description,benefits:p.benefits.join('\n'),amount:p.amount_cents?String(p.amount_cents/100):'',billing_period:p.billing_period,checkout_url:p.checkout_url||'',published:p.published,discount:String(p.ticket_discount_percent??0)})}/>}
  </View>)}
  {!form&&<Button label="Add membership tier" disabled={busy} onPress={()=>setForm({...blank})}/>}
  {form&&<View>
   <TextInput accessibilityLabel="Tier name" style={styles.input} value={form.name} onChangeText={name=>setForm({...form,name})} placeholder="Tier name"/>
   <TextInput accessibilityLabel="Tier description" style={styles.input} value={form.description} onChangeText={description=>setForm({...form,description})} placeholder="Description" multiline/>
   <TextInput accessibilityLabel="Tier benefits" style={styles.input} value={form.benefits} onChangeText={benefits=>setForm({...form,benefits})} placeholder="Benefits (one per line)" multiline/>
   <TextInput accessibilityLabel="Tier price" style={styles.input} value={form.amount} onChangeText={amount=>setForm({...form,amount})} placeholder="Price in dollars" keyboardType="decimal-pad"/>
   <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{(['monthly','annually','one_time'] as const).map(b=><Button key={b} label={`${form.billing_period===b?'✓ ':''}${periodLabel(b)||b}`} onPress={()=>setForm({...form,billing_period:b})}/>)}</View>
   <TextInput accessibilityLabel="Tier checkout link" style={styles.input} value={form.checkout_url} onChangeText={checkout_url=>setForm({...form,checkout_url})} placeholder="CharityStack checkout link (https://…)" autoCapitalize="none"/>
   <TextInput accessibilityLabel="Tier ticket discount" style={styles.input} value={form.discount} onChangeText={discount=>setForm({...form,discount})} placeholder="Member ticket discount %" keyboardType="number-pad"/>
   <View><Text style={styles.text}>Published</Text><Switch accessibilityLabel="Tier published" value={form.published} onValueChange={published=>setForm({...form,published})}/></View>
   <Button label={busy?'Saving…':'Save tier'} disabled={busy} onPress={save}/><Button label="Discard tier edits" disabled={busy} onPress={()=>setForm(null)}/>
  </View>}
  <Text style={styles.heading}>Membership change requests</Text>
  {!data.requests.length&&<Text style={styles.text}>No requests.</Text>}
  {data.requests.map(r=><View key={r.id}><Text style={styles.text}>{r.full_name} · {labels[r.kind]}{r.kind==='change_plan'?` (${r.current_plan} → ${r.target_plan})`:''} · {r.status}</Text>
   {r.status==='requested'&&<><Text style={styles.text}>Make the change in CharityStack first, then confirm it here.</Text><Button label={`Confirm ${labels[r.kind].toLowerCase()} for ${r.full_name}`} disabled={busy} onPress={()=>void run(()=>reviewMembershipChange(r.id,true),'Membership updated.')}/><Button label={`Decline request from ${r.full_name}`} disabled={busy} onPress={()=>void run(()=>reviewMembershipChange(r.id,false),'Request declined.')}/></>}
  </View>)}
 </View>
}
