import { useCallback } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { listPublicEvents, type PublicEvent } from '@/services/backlogService'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
// #118 Public content: upcoming events an administrator has published, viewable without an account.
export default function PublicEventsScreen() {
 const load=useCallback(()=>listPublicEvents(),[])
 const {data,loading,error,reload}=useFocusResource(load,[] as PublicEvent[])
 return <><Stack.Screen options={{title:'Thabaat events'}}/><ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.title}>Upcoming Thabaat events</Text>
  <Text style={styles.text}>Browse public events. Sign in or create a free account to register.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
  {!loading&&!error&&!data.length&&<Text style={styles.text}>No public events right now. Check back soon.</Text>}
  {data.map(e=><View key={e.event_id} style={styles.card}><Text style={styles.heading}>{e.title}</Text><Text style={styles.text}>{new Date(e.event_date).toLocaleString()} · {e.venue}</Text>{!!e.summary&&<Text style={styles.text}>{e.summary}</Text>}<Button label={`View ${e.title}`} onPress={()=>router.push(`/public/event/${e.event_id}`)}/></View>)}
  <Button label="Sign in or create an account" onPress={()=>router.push('/auth/login')}/>
  <Button label={loading?'Refreshing…':'Refresh events'} disabled={loading} onPress={()=>void reload()}/>
 </ScrollView></>
}
