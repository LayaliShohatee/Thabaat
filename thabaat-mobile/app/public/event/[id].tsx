import { useCallback } from 'react'
import { Image, Linking, Platform, ScrollView, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { useAuth } from '@/hooks/useAuth'
import { getPublicEvent, type PublicEvent } from '@/services/backlogService'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
// #117/#120 Public event page: the web fallback for shared links. Opens the app when installed, otherwise shows this page.
export default function PublicEventScreen() {
 const {id}=useLocalSearchParams<{id:string}>()
 const {user}=useAuth()
 const load=useCallback(()=>getPublicEvent(id),[id])
 const {data:event,loading,error}=useFocusResource(load,null as PublicEvent|null)
 return <><Stack.Screen options={{title:'Thabaat event'}}/><ScrollView style={styles.page} contentContainerStyle={styles.content}>
  {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
  {!loading&&!error&&!event&&<Text style={styles.text}>This event is not public or is no longer available.</Text>}
  {event&&<View style={styles.card}>
   {!!event.image_url&&<Image source={{uri:event.image_url}} accessibilityLabel={`${event.title} flyer`} style={{width:'100%',height:200,borderRadius:12}} resizeMode="cover"/>}
   <Text style={styles.title}>{event.title}</Text>
   <Text style={styles.text}>{new Date(event.event_date).toLocaleString()} · {event.venue}</Text>
   {!!event.summary&&<Text style={styles.text}>{event.summary}</Text>}
   {user?<Button label="Open full event and register" onPress={()=>router.push(`/event/${event.event_id}`)}/>:<>
    {Platform.OS==='web'&&<Button label="Open in the Thabaat app" onPress={()=>void Linking.openURL(`thabaat://event/${event.event_id}`)}/>}
    <Button label="Sign in to register" onPress={()=>router.push(`/auth/login?eventId=${event.event_id}`)}/>
   </>}
  </View>}
  <Button label="See all public events" onPress={()=>router.push('/public')}/>
 </ScrollView></>
}
