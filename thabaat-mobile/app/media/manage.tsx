import { Stack } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, Switch, View } from 'react-native'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getMedia, saveMedia, deleteMedia } from '@/services/mediaService'
import { getPermissions } from '@/services/managementService'
import { Alert } from '@/lib/alert'
import type { MediaItem } from '@/lib/media'
import { chooseMediaVideo,uploadMediaVideo } from '@/services/mediaUploadService'
import type { MediaUploadAsset } from '@/lib/media-upload'
const blank={title:'',description:'',category:'',object_path:'',members_only:false,published:false}
export default function ManageMedia() {
 const load=useCallback(async()=>{const permissions=await getPermissions();if(!permissions.can_manage_events)throw new Error('Organizer or administrator required.');return {permissions,items:await getMedia()}},[])
 const {data,loading,error,reload}=useFocusResource(load,null)
 const [draft,setDraft]=useState<Partial<MediaItem>>(blank),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const pending=useRef(false)
 const [video,setVideo]=useState<MediaUploadAsset|null>(null)
 async function pick(){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{const chosen=await chooseMediaVideo();if(chosen)setVideo(chosen)}catch(err){setMessage(err instanceof Error?err.message:'Video picker unavailable. Select a file again.')}finally{pending.current=false;setBusy(false)}}
 async function upload(){if(!video||pending.current)return;pending.current=true;setBusy(true);setMessage('');try{const path=await uploadMediaVideo(video);setDraft(current=>({...current,object_path:path,published:false}));setVideo(null);setMessage('Private video uploaded. Complete the metadata and save this draft before publishing. An uploaded file is retained if you abandon its draft.')}catch(err){setMessage(err instanceof Error?err.message:'Video upload failed. Retry or select another file.')}finally{pending.current=false;setBusy(false)}}
 async function save(){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await saveMedia(draft);setMessage('Media saved.');setDraft(blank);await reload()}catch(err){setMessage(err instanceof Error?err.message:typeof err==='object'&&err&&'message'in err?String(err.message):'Media could not save.')}finally{pending.current=false;setBusy(false)}}
 async function remove(){
  if(!draft.id||pending.current)return
  pending.current=true;setBusy(true);setMessage('')
  try{await deleteMedia(draft.id);setDraft(blank);setMessage('Recording removed from the library. The stored video file was retained.');await reload()}catch(err){setMessage(err instanceof Error?err.message:'Recording could not be removed.')}finally{pending.current=false;setBusy(false)}
 }
 return <ScrollView style={{flex:1,backgroundColor:'#000'}} contentContainerStyle={{padding:20,gap:14}}>
 <Stack.Screen options={{title:'Manage media'}}/>
 <Text style={{color:'#fff',fontSize:24}}>Manage media</Text>
 {loading?<Text style={{color:'#bbb'}}>Loading…</Text>:error?<><Text accessibilityRole="alert" style={{color:'#bbb'}}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={reload}><Text style={{color:'#fff'}}>Try again</Text></TouchableOpacity></>:data&&<>
 <Text style={{color:'#bbb'}}>Upload an approved MP4/MOV video up to 100 MiB to private storage. Drafts are visible only to their organizer and administrators. Uploading does not publish the recording.</Text>
 <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>void pick()}><Text style={{color:'#fff',padding:12}}>Choose video file</Text></TouchableOpacity>
 {video&&<><Text style={{color:'#bbb'}}>{video.name} · {Math.round((video.size??0)/1024)} KiB</Text><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>void upload()}><Text style={{color:'#fff',padding:12}}>{busy?'Working…':'Upload selected video privately'}</Text></TouchableOpacity></>}
 {data.items.filter(i=>data.permissions.staff_role==='admin'||i.created_by===data.permissions.user_id).map(i=><TouchableOpacity key={i.id} accessibilityRole="button" disabled={busy} onPress={()=>{setDraft(i);setMessage('')}}><Text style={{color:'#fff',paddingVertical:8}}>{i.title} · {i.published?'Published':'Draft'}</Text></TouchableOpacity>)}
 <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>{setDraft(blank);setMessage('')}}><Text style={{color:'#fff'}}>New recording</Text></TouchableOpacity>
 {(['title','description','category','object_path'] as const).map(field=><TextInput key={field} editable={!busy} accessibilityLabel={`Media ${field.replace('_',' ')}`} placeholder={field==='object_path'?'Private object path (e.g. talks/recording.mp4)':field} placeholderTextColor="#999" value={String(draft[field]??'')} onChangeText={v=>setDraft({...draft,[field]:v})} multiline={field==='description'} style={{color:'#fff',borderWidth:1,borderColor:'#555',padding:12,borderRadius:8}}/>)}
 <View style={{flexDirection:'row',alignItems:'center',gap:10}}><Text style={{color:'#fff'}}>Members only</Text><Switch disabled={busy} accessibilityLabel="Members only media" value={!!draft.members_only} onValueChange={v=>setDraft({...draft,members_only:v})}/></View>
 <View style={{flexDirection:'row',alignItems:'center',gap:10}}><Text style={{color:'#fff'}}>Published</Text><Switch disabled={busy} accessibilityLabel="Published media" value={!!draft.published} onValueChange={v=>setDraft({...draft,published:v})}/></View>
 <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save} style={{padding:14,backgroundColor:'#fff',borderRadius:8}}><Text>{busy?'Saving…':draft.id?'Save changes':'Create recording'}</Text></TouchableOpacity>
 {draft.id&&<TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>Alert.alert('Delete library entry?','This removes the recording metadata and saved progress. The stored video file is retained.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>{void remove()}}])}><Text style={{color:'#fca5a5',padding:12}}>Delete library entry</Text></TouchableOpacity>}
 {!!message&&<Text accessibilityLiveRegion="polite" style={{color:'#ddd'}}>{message}</Text>}
 </>}
 </ScrollView>
}
