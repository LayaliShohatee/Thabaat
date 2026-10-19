import { useCallback } from 'react'
import { ScrollView, Text } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { Stack, useLocalSearchParams } from 'expo-router'
import { getMedia } from '@/services/mediaService'
import { useFocusResource } from '@/hooks/useFocusResource'
import type { MediaItem } from '@/lib/media'
import MediaPlayer from '@/components/MediaPlayer'
import { brand } from '@/constants/brand'
export default function MediaDetail() {
 const {id}=useLocalSearchParams<{id:string}>()
 const load=useCallback(async()=> (await getMedia()).find(i=>i.id===id)??null,[id])
 const {data,loading,error,reload}=useFocusResource<MediaItem|null>(load,null)
 return <ScrollView style={{flex:1,backgroundColor:'#000'}} contentContainerStyle={{padding:20,gap:14}}>
 <Stack.Screen options={{title:'Recording'}}/>
  {loading?<Text style={{color:'#ddd'}}>Loading…</Text>:error?<><Text style={{color:'#ddd'}}>{error}</Text><PressableScale accessibilityRole="button" onPress={reload}><Text style={{color: brand.page}}>Try again</Text></PressableScale></>:data?<><Text style={{color: brand.page,fontSize:24}}>{data.title}</Text><Text style={{color:'#bbb'}}>{data.category} · {data.members_only?'Current membership required':'Available to all signed-in members'}</Text><MediaPlayer key={data.id} item={data}/><Text style={{color:'#ddd'}}>{data.description}</Text></>:<Text style={{color:'#ddd'}}>This recording is unavailable.</Text>}
 </ScrollView>
}
