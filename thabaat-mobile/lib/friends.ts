export function knownAccountId(value:string,ownId?:string){
 const id=value.trim().toLowerCase()
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new Error('Enter the account ID your friend gave you. Email and name searches are not supported.')
 if(id===ownId?.toLowerCase())throw new Error('Enter another account ID.')
 return id
}
export type Friend={user_id:string;full_name:string}
export type FriendRequest={id:string;requester_name:string;requested_at:string}
export type FriendInvitation={id:string;sender_name:string;event_id:string;event_title:string;status:'pending'|'opened';created_at:string}
export type FriendNetwork={account_id:string;share_attendance:boolean;friends:Friend[];requests:FriendRequest[];invitations:FriendInvitation[]}
export const emptyFriendNetwork:FriendNetwork={account_id:'',share_attendance:false,friends:[],requests:[],invitations:[]}
