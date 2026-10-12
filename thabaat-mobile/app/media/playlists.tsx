import {useCallback,useRef,useState} from 'react'
import {ScrollView,Text,TextInput,View} from 'react-native'
import {router,Stack} from 'expo-router'
import {useFocusResource} from '@/hooks/useFocusResource'
import {ManagementButton as Button,managementStyles as styles} from '@/components/ManagementUI'
import {Alert} from '@/lib/alert'
import {getMedia} from '@/services/mediaService'
import {getMediaPlaylists,getMediaPlaylistItems,createMediaPlaylist,renameMediaPlaylist,deleteMediaPlaylist,addMediaToPlaylist,removeMediaFromPlaylist,moveMediaPlaylistItem} from '@/services/mediaPlaylistService'
export default function Playlists(){
 const [selected,setSelected]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const pending=useRef(false)
 const load=useCallback(async()=>({playlists:await getMediaPlaylists(),media:await getMedia(),items:selected?await getMediaPlaylistItems(selected):[]}),[selected])
 const {data,loading,error,reload}=useFocusResource(load,null)
 async function run(action:()=>Promise<unknown>){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await action();await reload()}catch(err){setMessage(err instanceof Error?err.message:'Playlist action failed. Please retry.')}finally{pending.current=false;setBusy(false)}}
 const current=data?.playlists.find(list=>list.id===selected)
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}><Stack.Screen options={{title:'My playlists'}}/><Text style={styles.title}>My playlists</Text><Text style={styles.text}>Private lists of recordings. Saving a member recording does not grant playback access; membership is checked each time.</Text>
 {loading?<Text style={styles.text}>Loading playlists…</Text>:error?<><Text accessibilityRole="alert" style={styles.alert}>{error}</Text><Button label="Try again" onPress={()=>void reload()}/></>:data&&<>
 <TextInput accessibilityLabel="Playlist name" placeholder="Playlist name" placeholderTextColor="#999" value={name} onChangeText={setName} editable={!busy} style={styles.input}/>
 <Button label="Create playlist" disabled={busy||!name.trim()} onPress={()=>void run(async()=>{await createMediaPlaylist(name);setName('')})}/>
 {!data.playlists.length&&<Text style={styles.text}>No playlists yet. Create your first list above.</Text>}
 {data.playlists.map(list=><Button key={list.id} label={`${list.id===selected?'Selected: ':''}${list.name}`} disabled={busy} onPress={()=>{setSelected(list.id);setName(list.name)}}/>)}
 {current&&<View style={styles.card}><Text style={styles.heading}>{current.name}</Text><Button label="Rename selected playlist" disabled={busy||!name.trim()} onPress={()=>void run(()=>renameMediaPlaylist(current.id,name))}/><Button label="Delete selected playlist" disabled={busy} onPress={()=>Alert.alert('Delete playlist?','Only this list is removed. Recordings and playback progress stay in the library.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void run(async()=>{await deleteMediaPlaylist(current.id);setSelected('');setName('')})}])}/>
 {!data.items.length&&<Text style={styles.text}>This playlist is empty. Add a recording below.</Text>}
 {data.items.map((entry,index)=>{const item=data.media.find(media=>media.id===entry.media_id);return <View key={entry.media_id} style={styles.card}><Text style={styles.heading}>{index+1}. {item?.title??'Recording unavailable'}</Text>{item&&<Button label={`Open ${item.title}`} disabled={busy} onPress={()=>router.push(`/media/${item.id}`)}/>}<Button label="Move up" disabled={busy||index===0} onPress={()=>void run(()=>moveMediaPlaylistItem(current.id,entry.media_id,-1))}/><Button label="Move down" disabled={busy||index===data.items.length-1} onPress={()=>void run(()=>moveMediaPlaylistItem(current.id,entry.media_id,1))}/><Button label="Remove from playlist" disabled={busy} onPress={()=>void run(()=>removeMediaFromPlaylist(current.id,entry.media_id))}/></View>})}
 <Text style={styles.heading}>Add recordings</Text>{data.media.filter(item=>!data.items.some(entry=>entry.media_id===item.id)).map(item=><Button key={item.id} label={`Add ${item.title}${item.members_only?' (members)':''}`} disabled={busy} onPress={()=>void run(()=>addMediaToPlaylist(current.id,item.id))}/>)}</View>}
 </>}{!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}</ScrollView>
}
