import { useCallback } from 'react'
import { ScrollView, Text, StyleSheet } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { fonts } from '@/constants/brand'
import { router, useLocalSearchParams } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getEventAccess } from '@/services/paidEventService'
export default function EventAccessScreen() {
 const { id }=useLocalSearchParams<{id:string}>()
 const load=useCallback(() => id ? getEventAccess(id) : Promise.reject(new Error('Missing event ID.')),[id])
 const {data,loading,error,reload}=useFocusResource(load,null)
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.title}>{loading ? 'Checking access…' : error ? 'Unable to check access' : data ? 'Your event access' : 'Access locked'}</Text>
  <Text style={styles.text}>{error || data || (!loading ? 'A confirmed paid registration is required. Returning from checkout or opening this link does not unlock access.' : '')}</Text>
  <PressableScale accessibilityRole="button" disabled={loading} style={styles.button} onPress={() => void reload()}><Text>Refresh access</Text></PressableScale>
  <PressableScale accessibilityRole="button" style={styles.button} onPress={() => router.replace('/(tabs)/events?view=tickets')}><Text>My tickets</Text></PressableScale>
 </ScrollView>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000'},content:{padding:24,gap:20},title:{color:'#fff',fontSize:28,fontFamily: fonts.heading},text:{color:'#ddd',fontSize:17,lineHeight:26},button:{backgroundColor:'#fff',padding:16,borderRadius:10,alignItems:'center'}})
