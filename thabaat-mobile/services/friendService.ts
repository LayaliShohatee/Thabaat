import { supabase } from '@/lib/supabase'
import type { Friend,FriendNetwork } from '@/lib/friends'
async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(['PGRST202','42883','42P01'].includes(error.code)?'Friends setup is not installed on this database. Ask the team to apply the tested friends migration.':error.message);return data as T}
export const getFriendNetwork=()=>rpc<FriendNetwork>('my_friend_network')
export const requestKnownFriend=(id:string)=>rpc<void>('request_known_friend',{p_friend_id:id})
export const respondToFriend=(id:string,accept:boolean)=>rpc<void>('respond_friend_request',{p_request_id:id,p_accept:accept})
export const removeKnownFriend=(id:string)=>rpc<void>('remove_known_friend',{p_friend_id:id})
export const saveAttendancePrivacy=(share:boolean)=>rpc<void>('set_attendance_privacy',{p_share:share})
export const inviteFriend=(friendId:string,eventId:string)=>rpc<void>('invite_friend_to_event',{p_friend_id:friendId,p_event_id:eventId})
export const openFriendInvite=(id:string)=>rpc<string>('open_friend_event_invite',{p_invite_id:id})
export const dismissFriendInvite=(id:string)=>rpc<void>('dismiss_friend_event_invite',{p_invite_id:id})
export const getFriendsAttending=(eventId:string)=>rpc<Friend[]>('friends_attending_event',{p_event_id:eventId})
