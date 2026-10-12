import {beforeEach,expect,it,vi} from 'vitest'
const fake=vi.hoisted(()=>{const query:any={};for(const name of ['select','eq'])query[name]=vi.fn(()=>query);query.order=vi.fn();return {query,from:vi.fn(()=>query),rpc:vi.fn()}})
vi.mock('@/lib/supabase',()=>({supabase:{from:fake.from,rpc:fake.rpc}}))
import {getUserRegistrations} from '../services/registrationService'
beforeEach(()=>vi.clearAllMocks())
it('shows only server-saved owner attendance on confirmed bookings and never includes the credential in list data',async()=>{
 fake.query.order.mockResolvedValue({data:[{id:'confirmed',status:'confirmed'},{id:'cancelled',status:'cancelled'}],error:null})
 fake.rpc.mockResolvedValue({data:{checked_in_at:'saved-time',token:'private-ticket'},error:null})
 const rows=await getUserRegistrations('owner');expect(rows[0].checked_in_at).toBe('saved-time');expect(rows[1].checked_in_at).toBeUndefined();expect(JSON.stringify(rows)).not.toContain('private-ticket');expect(fake.rpc).toHaveBeenCalledOnce();expect(fake.rpc).toHaveBeenCalledWith('get_my_ticket',{p_registration_id:'confirmed'});expect(fake.query.eq).toHaveBeenCalledWith('user_id','owner')
})
it('attendance read failure leaves the booking visible with unknown attendance, never invents a not-checked-in result',async()=>{
 fake.query.order.mockResolvedValue({data:[{id:'confirmed',status:'confirmed'}],error:null});fake.rpc.mockResolvedValue({data:null,error:{message:'offline'}})
 const rows=await getUserRegistrations('owner');expect(rows).toEqual([{id:'confirmed',status:'confirmed'}])
})
