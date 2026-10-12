import {afterEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),from:vi.fn(),upsert:vi.fn(),eq:vi.fn()}))
vi.mock('@/lib/supabase',()=>({supabase:{from:state.from}}))
import {loadNotificationPreferences,saveNotificationPreferences} from '../services/notificationPreferencesService'
import {defaultNotificationPreferences} from '../lib/notification-preferences'
afterEach(()=>vi.clearAllMocks())
function mockTable(){
 const query={select:()=>query,eq:state.eq,maybeSingle:state.read,single:state.write,upsert:state.upsert}
 state.eq.mockReturnValue(query);state.upsert.mockReturnValue(query);state.from.mockReturnValue(query)
}
it('reads only the requested account and defaults to explicit opt-in',async()=>{
 mockTable();state.read.mockResolvedValue({data:null,error:null})
 expect(await loadNotificationPreferences('fixture-user')).toEqual(defaultNotificationPreferences())
 expect(state.eq).toHaveBeenCalledWith('user_id','fixture-user')
})
it('schema/read outages are visible rather than masquerading as saved preferences',async()=>{
 mockTable();state.read.mockResolvedValue({data:null,error:{message:'unavailable'}})
 await expect(loadNotificationPreferences('fixture-user')).rejects.toThrow('unavailable')
})
it('failed save is retryable and persists only normalized own-account fields',async()=>{
 mockTable();state.write.mockResolvedValueOnce({data:null,error:{message:'offline'}}).mockResolvedValueOnce({data:{...defaultNotificationPreferences(),push_enabled:true,categories:['women']},error:null})
 const value={...defaultNotificationPreferences(),push_enabled:true,categories:['women','unsupported']}
 await expect(saveNotificationPreferences('fixture-user',value)).rejects.toThrow('not saved')
 expect(await saveNotificationPreferences('fixture-user',value)).toMatchObject({push_enabled:true,categories:['women']})
 expect(state.upsert).toHaveBeenLastCalledWith({user_id:'fixture-user',...defaultNotificationPreferences(),push_enabled:true,categories:['women']},{onConflict:'user_id'})
})
