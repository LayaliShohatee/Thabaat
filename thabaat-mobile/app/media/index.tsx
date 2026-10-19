import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { brand, fonts } from '@/constants/brand'
import { router, Stack } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getMedia } from '@/services/mediaService'
import { filterMedia, type MediaItem } from '@/lib/media'

export default function MediaLibrary() {
 const load=useCallback(()=>getMedia(),[])
 const {data,loading,error,reload}=useFocusResource<MediaItem[]>(load,[])
 const [search,setSearch]=useState(''),[category,setCategory]=useState('')
 const categories=Array.from(new Set(data.map(i=>i.category))).sort()
 const items=filterMedia(data,search,category)
 return <ScrollView style={styles.page} contentContainerStyle={{padding:20,gap:14}}>
 <Stack.Screen options={{title:'Media Library'}}/>
  <Text style={styles.title}>Media Library</Text>
  <Text style={styles.note}>Explore talks and recordings. Member recordings require a current verified membership.</Text>
  <PressableScale accessibilityRole="button" onPress={()=>router.push('/media/playlists')}><Text style={styles.link}>My playlists</Text></PressableScale>
  <PressableScale accessibilityRole="button" onPress={()=>router.push('/media/manage')}><Text style={styles.link}>Manage media (staff)</Text></PressableScale>
  <TextInput accessibilityLabel="Search media" placeholder="Search title, description or category" placeholderTextColor="#999" value={search} onChangeText={setSearch} style={styles.input}/>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{['',...categories].map(c=><PressableScale key={c} accessibilityRole="button" accessibilityState={{selected:category===c}} onPress={()=>setCategory(c)} style={[styles.chip,category===c&&{borderColor: brand.card}]}><Text style={styles.text}>{c||'All categories'}</Text></PressableScale>)}</View>
  {loading?<Text style={styles.note}>Loading…</Text>:error?<View><Text accessibilityRole="alert" style={styles.note}>{error}</Text><PressableScale accessibilityRole="button" onPress={reload}><Text style={styles.link}>Try again</Text></PressableScale></View>:!data.length?<Text style={styles.note}>No recordings have been published yet.</Text>:!items.length?<View><Text style={styles.note}>No recordings match your filters.</Text><PressableScale accessibilityRole="button" onPress={()=>{setSearch('');setCategory('')}}><Text style={styles.link}>Clear filters</Text></PressableScale></View>:items.map(item=><PressableScale key={item.id} accessibilityRole="button" style={styles.card} onPress={()=>router.push(`/media/${item.id}`)}><Text style={styles.title}>{item.title}</Text><Text style={styles.note}>{item.category} · {item.members_only?'Members':'Everyone'}{!item.published?' · Draft':''}</Text><Text style={styles.text}>{item.description}</Text></PressableScale>)}
 </ScrollView>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000'},title:{color: brand.page,fontSize:22,fontFamily: fonts.heading},note:{color:'#bbb',lineHeight:22},text:{color:'#eee'},link:{color: brand.page,textDecorationLine:'underline',paddingVertical:10},input:{borderWidth:1,borderColor:'#555',borderRadius:8,color: brand.page,padding:12},chip:{padding:10,borderColor:'#444',borderWidth:1,borderRadius:20},card:{padding:16,borderWidth:1,borderColor:'#444',borderRadius:10,gap:8}})
