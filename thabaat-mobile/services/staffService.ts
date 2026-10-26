import { Platform } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File as NativeFile } from 'expo-file-system'
import { supabase } from '@/lib/supabase'
import type { MediaUploadAsset } from '@/lib/media-upload'
export type VolunteerShift = { event_id: string; title?: string; event_date?: string; location?: string; user_id?: string; full_name?: string; duty: string; shift_start: string; shift_end: string; active: boolean; reviewed_hours: number; is_lead?: boolean; role_description?: string }
export type VolunteerApplication = { user_id?: string; full_name?: string; motivation: string; status: 'submitted'|'approved'|'declined'; answers?: Record<string, string|number|string[]>|null; resume_path?: string|null; updated_at?: string }
export type VolunteerWork = { application: VolunteerApplication|null; assignments: VolunteerShift[] }
export type StaffReport = { event: {title:string;capacity:number;event_date:string}; volunteer_candidates?: {user_id:string;full_name:string}[]; registrations: {registration_id:string;full_name:string;ticket_name:string;status:string;registered_at:string}[]; volunteers: VolunteerShift[] }
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T> {
 const {data,error}=await supabase.rpc(name,args)
 if(error) throw new Error(['PGRST202','42P01'].includes(error.code)?'Volunteer/reporting setup is not installed on this database.':error.message)
 return data as T
}
export const getVolunteerWork=()=>rpc<VolunteerWork>('my_volunteer_work')
// The full volunteer interest form (lib/volunteer-form.ts); resumePath comes from uploadVolunteerResume.
export const submitVolunteerInterest=(answers:object,resumePath:string|null)=>rpc<void>('submit_volunteer_interest',{p_answers:answers,p_resume_path:resumePath})
const RESUME_BUCKET='thabaat-volunteer-resumes',MAX_RESUME_BYTES=10*1024*1024
export async function chooseVolunteerResume():Promise<MediaUploadAsset|null>{
 const result=await DocumentPicker.getDocumentAsync({type:'application/pdf',multiple:false,copyToCacheDirectory:true,base64:false})
 if(result.canceled)return null
 const asset=result.assets[0]
 if(!asset.name.toLowerCase().endsWith('.pdf'))throw new Error('Choose a PDF file.')
 if(Number(asset.size)>MAX_RESUME_BYTES)throw new Error('Choose a PDF under 10 MB.')
 return asset
}
// Uploads into the applicant's own folder (storage policy thabaat_resume_upload); returns the storage path.
export async function uploadVolunteerResume(asset:MediaUploadAsset):Promise<string>{
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw new Error('Sign in to upload a resume.')
 const bytes=Platform.OS==='web'&&asset.file?new Uint8Array(await asset.file.arrayBuffer()):await new NativeFile(asset.uri).bytes()
 if(bytes.length<5||bytes.length>MAX_RESUME_BYTES||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw new Error('This file is not a PDF under 10 MB.')
 const random=Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join('')
 const path=`${session.user.id}/${random}.pdf`
 const {error}=await supabase.storage.from(RESUME_BUCKET).upload(path,bytes.buffer as ArrayBuffer,{contentType:'application/pdf',upsert:false})
 if(error)throw new Error('Resume upload failed. Try again or send the form without it.')
 return path
}
// Administrators only (storage policy thabaat_resume_admin_read); the link expires after 10 minutes.
export async function volunteerResumeUrl(path:string):Promise<string>{
 const {data,error}=await supabase.storage.from(RESUME_BUCKET).createSignedUrl(path,600)
 if(error||!data)throw new Error('Could not open this resume.')
 return data.signedUrl
}
export const getVolunteerApplications=()=>rpc<VolunteerApplication[]>('list_volunteer_applications')
export const reviewVolunteerApplication=(userId:string,status:'approved'|'declined')=>rpc<void>('review_volunteer_application',{p_user_id:userId,p_status:status})
export const getStaffReport=(eventId:string)=>rpc<StaffReport>('staff_event_report',{p_event_id:eventId})
export const saveVolunteerAssignment=(input:{eventId:string;userId:string;duty:string;start:string;end:string;active:boolean;hours:number})=>rpc<void>('set_volunteer_assignment',{p_event_id:input.eventId,p_user_id:input.userId,p_duty:input.duty,p_start:input.start,p_end:input.end,p_active:input.active,p_hours:input.hours})
