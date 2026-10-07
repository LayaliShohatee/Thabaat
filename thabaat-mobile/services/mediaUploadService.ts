import { Platform } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File as NativeFile } from 'expo-file-system'
import { supabase } from '@/lib/supabase'
import { getPermissions } from '@/services/managementService'
import { mediaUploadPath,validateMediaHeader,validateMediaUpload,type MediaUploadAsset } from '@/lib/media-upload'
export async function chooseMediaVideo():Promise<MediaUploadAsset|null> {
 const result=await DocumentPicker.getDocumentAsync({type:['video/mp4','video/quicktime'],multiple:false,copyToCacheDirectory:true,base64:false})
 if(result.canceled)return null
 const asset=result.assets[0];validateMediaUpload(asset);return asset
}
export async function uploadMediaVideo(asset:MediaUploadAsset):Promise<string> {
 const permissions=await getPermissions()
 if(!permissions.can_manage_events||!['admin','organizer'].includes(permissions.staff_role??''))throw new Error('Organizer or administrator required to upload videos.')
 const info=validateMediaUpload(asset)
 const bytes=Platform.OS==='web'&&asset.file?new Uint8Array(await asset.file.arrayBuffer()):await new NativeFile(asset.uri).bytes()
 validateMediaUpload(asset,bytes.length);validateMediaHeader(bytes)
 // Namespace is the authorization boundary; random names prevent collisions, never act as bearer credentials.
 const random=Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join('')
 const path=mediaUploadPath(permissions.user_id,info.extension,random)
 const {error}=await supabase.storage.from('thabaat-media').upload(path,bytes.buffer as ArrayBuffer,{contentType:info.mime,upsert:false})
 if(error)throw new Error('Video upload failed. Your draft is unchanged. Select or retry the file.')
 if(Platform.OS!=='web'){const cache=new NativeFile(asset.uri);if(cache.exists)cache.delete()}
 return path
}
