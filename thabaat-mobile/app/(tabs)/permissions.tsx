import { useRef,useState } from 'react'
import { ScrollView,Text,TextInput,View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getPermissions,searchRoleAccounts,setStaffRole,type Permissions,type RoleAccount,type StaffRole } from '@/services/managementService'
import { ManagementButton as Button,managementStyles as styles } from '@/components/ManagementUI'
export default function PermissionsTab() {
 const {data,loading,error,reload}=useFocusResource(getPermissions,null as Permissions|null)
 const [search,setSearch]=useState(''),[accounts,setAccounts]=useState<RoleAccount[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [change,setChange]=useState<{account:RoleAccount;role:StaffRole|null}|null>(null)
 const locked=useRef(false)
 async function find(){if(locked.current)return;locked.current=true;setBusy(true);setMessage('');setAccounts([]);try{const rows=await searchRoleAccounts(search);setAccounts(rows);if(!rows.length)setMessage('No matching accounts.')}catch(e){setMessage(e instanceof Error?e.message:'Search failed')}finally{locked.current=false;setBusy(false)}}
 async function confirm(){if(!change||locked.current)return;locked.current=true;setBusy(true);setMessage('');try{await setStaffRole(change.account.user_id,change.role);setMessage('Staff role updated and recorded in the audit log.');setChange(null);setAccounts([]);await reload()}catch(e){setMessage(e instanceof Error?e.message:'Role update failed')}finally{locked.current=false;setBusy(false)}}
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Text style={styles.title}>Permissions</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
  {data&&<View style={styles.card}><Text style={styles.heading}>Your access</Text><Text style={styles.text}>Membership: {data.paid_member?'Paid':'Free'} · Staff role: {data.staff_role||'None'}</Text><Text style={styles.text}>{data.can_manage_events?'You can manage events.':'You can browse events and manage your own registrations.'}</Text><Text style={styles.text}>{data.can_manage_roles?'You can assign staff roles.':'Staff role changes require an administrator.'}</Text></View>}
  <View style={styles.card}><Text style={styles.heading}>Roles explained</Text><Text style={styles.text}>Free: public event browsing and registration.{ '\n'}Paid: verified membership; does not grant staff privileges.{ '\n'}Volunteer: staff designation; check-in tools are still pending.{ '\n'}Organizer: create events and manage their own events.{ '\n'}Admin: manage all events and assign staff roles.</Text><Text style={styles.text}>Paid status comes from verified membership records. Staff roles cannot activate a paid membership.</Text></View>
  {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
  {data?.can_manage_roles&&<View style={styles.card}><Text style={styles.heading}>Manage staff roles</Text><TextInput accessibilityLabel="Find account" placeholder="Name or email (at least 3 characters)" value={search} onChangeText={setSearch} style={styles.input} autoCapitalize="none"/><Button label="Search accounts" disabled={busy||search.trim().length<3} onPress={()=>void find()}/>
   {accounts.map(account=><View key={account.user_id} style={styles.card}><Text style={styles.heading}>{account.full_name||account.email}</Text><Text style={styles.text}>{account.email} · {account.staff_role||'No staff role'}</Text>{(['volunteer','organizer','admin',null] as const).map(role=><Button key={role||'none'} label={role?`Set ${role}`:'Remove staff role'} disabled={busy||role===account.staff_role} onPress={()=>setChange({account,role})}/>)}</View>)}
  </View>}
  {change&&<View style={styles.card}><Text style={styles.heading}>Confirm permission change</Text><Text style={styles.text}>Set {change.account.email} to {change.role||'no staff role'}? {change.role==='admin'?'Administrators can manage all events and grant other accounts staff access.':''}</Text><Button label="Confirm role change" disabled={busy} onPress={()=>void confirm()}/><Button label="Cancel change" disabled={busy} onPress={()=>setChange(null)}/></View>}
  <Button label={loading?'Refreshing…':'Refresh permissions'} disabled={loading||busy} onPress={()=>void reload()}/>
 </ScrollView>
}
