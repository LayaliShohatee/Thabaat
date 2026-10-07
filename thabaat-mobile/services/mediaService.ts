import { supabase } from '@/lib/supabase'
import type { MediaItem } from '@/lib/media'
export async function getMedia():Promise<MediaItem[]> {
 const {data,error}=await supabase.from('media_items').select('*').order('created_at',{ascending:false})
 if(error)throw new Error(['42P01','PGRST205'].includes(error.code) ? 'The media library is not available on this environment yet.' : error.message)
 return data??[]
}
export async function getMediaPlayback(item:MediaItem) {
 const backend = process.env.EXPO_PUBLIC_BACKEND_URL
 if(!backend)throw new Error('Secure media playback is not available on this environment yet.')
 const {data:auth,error:authError}=await supabase.auth.getSession()
 if(authError||!auth.session)throw new Error('Sign in again to play this recording.')
 const response=await fetch(`${backend.replace(/\/$/,'')}/media/playback`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.session.access_token}`},body:JSON.stringify({mediaId:item.id}),signal:AbortSignal.timeout(10000)})
 if(!response.ok)throw new Error(response.status===403?'Playback unavailable. Current verified membership may be required.':'Secure playback could not open. Please try again.')
 const result=await response.json()
 if(typeof result.url!=='string')throw new Error('Secure playback returned an invalid response.')
 return result.url
}
export async function getMediaProgress(id:string) {
 const {data,error}=await supabase.from('media_progress').select('seconds').eq('media_id',id).maybeSingle()
 if(error)throw error
 return Number(data?.seconds??0)
}
export async function saveMediaProgress(id:string,seconds:number) {
 const {error}=await supabase.from('media_progress').upsert({media_id:id,seconds},{onConflict:'user_id,media_id'})
 if(error)throw error
}
export async function saveMedia(item:Partial<MediaItem>) {
 const payload={title:item.title?.trim(),description:item.description??'',category:item.category?.trim(),object_path:item.object_path?.trim(),members_only:item.members_only??false,published:item.published??false}
 const result=item.id?await supabase.from('media_items').update(payload).eq('id',item.id).select('id').single():await supabase.from('media_items').insert(payload).select('id').single()
 if(result.error)throw result.error
}
export async function deleteMedia(id:string) {
 const {error}=await supabase.from('media_items').delete().eq('id',id).select('id').single()
 if(error)throw new Error(error.message)
}
