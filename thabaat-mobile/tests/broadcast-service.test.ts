import {afterEach,expect,it,vi} from 'vitest'
const rpc=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}))
import {newBroadcastId,queueBroadcast,reviewBroadcast,type BroadcastDraft} from '../services/broadcastService'
const draft:BroadcastDraft={category:'conferences',eventId:null,membersOnly:true,volunteerOnly:false,title:'Synthetic only',body:'Fixture announcement'}
afterEach(()=>vi.clearAllMocks())
it('review and queue persist exact reviewed segments and stable request ID',async()=>{
 rpc.mockResolvedValue({data:2,error:null})
 expect(await reviewBroadcast(draft)).toBe(2)
 await queueBroadcast('40000000-0000-0000-0000-000000000001',draft)
 expect(rpc).toHaveBeenLastCalledWith('queue_notification_broadcast',{p_id:'40000000-0000-0000-0000-000000000001',p_category:'conferences',p_event_id:null,p_members_only:true,p_volunteer_only:false,p_title:'Synthetic only',p_body:'Fixture announcement'})
})
it('permission errors and malformed review results fail closed',async()=>{
 rpc.mockResolvedValueOnce({data:null,error:{message:'Administrator required'}}).mockResolvedValueOnce({data:null,error:null})
 await expect(reviewBroadcast(draft)).rejects.toThrow('Administrator')
 await expect(reviewBroadcast(draft)).rejects.toThrow('could not be verified')
})
it('server request IDs are verified and uncertain queue result stays retryable',async()=>{
 rpc.mockResolvedValueOnce({data:'40000000-0000-0000-0000-000000000001',error:null}).mockResolvedValueOnce({data:'invalid',error:null}).mockResolvedValueOnce({data:null,error:null})
 expect(await newBroadcastId()).toBe('40000000-0000-0000-0000-000000000001')
 await expect(newBroadcastId()).rejects.toThrow('immutable')
 await expect(queueBroadcast('40000000-0000-0000-0000-000000000001',draft)).rejects.toThrow('same request')
})
