import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getMyOpenMembershipChange, requestMembershipChange, type MembershipChangeKind } from '@/services/backlogService'
import { money, periodLabel, type Membership, type Plan } from '@/lib/billing'
import { ManagementButton as Button } from './ManagementUI'
const pending:Record<MembershipChangeKind,string>={cancel_renewal:'Your request to stop renewing is being processed.',resume_renewal:'Your request to keep renewing is being processed.',change_plan:'Your plan change is being processed.'}
// #53–55: renew, cancel renewal and upgrade/downgrade from inside the app. Staff complete the change in CharityStack.
export default function MembershipChangeCard({membership,plans,styles}:{membership:Membership;plans:Plan[];styles:{card:object;heading:object;copy:object}}) {
 const load=useCallback(()=>getMyOpenMembershipChange(),[])
 const {data:open,reload}=useFocusResource(load,null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function request(kind:MembershipChangeKind,target:string|null=null){if(busy)return;setBusy(true);setMessage('');try{await requestMembershipChange(kind,target);setMessage(pending[kind]+' You will see the update here once it is confirmed.');await reload()}catch(e){setMessage(e instanceof Error?e.message:'Request failed')}finally{setBusy(false)}}
 const others=plans.filter(p=>p.published&&p.id!==membership.plan_id&&p.acquisition_mode!=='complimentary')
 return <View style={styles.card}>
  <Text style={styles.heading}>Manage your membership</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.copy}>{message}</Text>}
  {open?<Text style={styles.copy}>{pending[open.kind]}</Text>:<>
   {membership.cancel_at_period_end
    ?<Button label={busy?'Sending…':'Keep renewing my membership'} disabled={busy} onPress={()=>void request('resume_renewal')}/>
    :<Button label={busy?'Sending…':'Stop renewing at the end of this period'} disabled={busy} onPress={()=>void request('cancel_renewal')}/>}
   {others.length>0&&<Text style={styles.copy}>Switch plan (upgrade or downgrade):</Text>}
   {others.map(p=><Button key={p.id} label={`Switch to ${p.name}${p.amount_cents?` · ${money(p.amount_cents,p.currency)} ${periodLabel(p.billing_period)}`:''}`} disabled={busy} onPress={()=>void request('change_plan',p.id)}/>)}
  </>}
  <Text style={styles.copy}>Changes take effect at your next billing date. Closing the app does not cancel a subscription.</Text>
 </View>
}
