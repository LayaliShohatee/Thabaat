import { Platform } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File as NativeFile } from 'expo-file-system'
import { supabase } from '@/lib/supabase'
import { getPermissions } from '@/services/managementService'
import { eventImagePath,validateEventImage,validateEventImageHeader } from '@/lib/event-image'
// Picks, validates and uploads an event flyer; returns its public HTTPS URL for the event's image_url.
export async function uploadEventFlyer():Promise<string|null> {
 const result=await DocumentPicker.getDocumentAsync({type:['image/jpeg','image/png','image/webp'],multiple:false,copyToCacheDirectory:true,base64:false})
 if(result.canceled)return null
 const asset=result.assets[0];validateEventImage(asset)
 const permissions=await getPermissions()
 if(!permissions.can_manage_events||!['admin','organizer'].includes(permissions.staff_role??''))throw new Error('Organizer or administrator required to upload flyers.')
 const bytes=Platform.OS==='web'&&asset.file?new Uint8Array(await asset.file.arrayBuffer()):await new NativeFile(asset.uri).bytes()
 const info=validateEventImage(asset,bytes.length);validateEventImageHeader(bytes,info.mime)
 const random=Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join('')
 const path=eventImagePath(permissions.user_id,info.extension,random)
 const {error}=await supabase.storage.from('thabaat-event-images').upload(path,bytes.buffer as ArrayBuffer,{contentType:info.mime,upsert:false})
 if(error)throw new Error('Flyer upload failed. Try again or paste an image link.')
 if(Platform.OS!=='web'){const cache=new NativeFile(asset.uri);if(cache.exists)cache.delete()}
 return supabase.storage.from('thabaat-event-images').getPublicUrl(path).data.publicUrl
}
