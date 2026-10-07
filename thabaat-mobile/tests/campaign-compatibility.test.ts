import { beforeEach,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn(),order:vi.fn()}))
vi.mock('@/lib/supabase',()=>({supabase:{rpc:mocks.rpc,from:mocks.from}}))
vi.mock('expo-web-browser',()=>({openBrowserAsync:vi.fn()}))
import { getCampaignData } from '../services/billingService'
beforeEach(()=>{vi.clearAllMocks();mocks.from.mockReturnValue({select:mocks.select});mocks.select.mockReturnValue({eq:mocks.eq});mocks.eq.mockReturnValue({order:mocks.order})})
it('older staging falls back to metadata without certifying legacy totals',async()=>{
 mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});mocks.order.mockResolvedValue({data:[{id:'one',name:'Campaign',raised_cents:99999,goal_cents:10000}],error:null});const result=await getCampaignData();expect(result.error).toBeNull();expect(result.data).toEqual([expect.objectContaining({raised_cents:0,verified_totals_available:false})]);expect(mocks.select).toHaveBeenCalledWith('id,name,description,checkout_url,recurring_available,goal_cents');
})
it('uses verified aggregate only when RPC succeeds and preserves other RPC errors',async()=>{
 mocks.rpc.mockResolvedValueOnce({data:[{id:'one',raised_cents:123}],error:null});expect((await getCampaignData()).data).toEqual([expect.objectContaining({raised_cents:123,verified_totals_available:true})]);expect(mocks.from).not.toHaveBeenCalled();
 mocks.rpc.mockResolvedValueOnce({data:null,error:{code:'42501',message:'Not permitted'}});expect((await getCampaignData()).error).toEqual({code:'42501',message:'Not permitted'});expect(mocks.from).not.toHaveBeenCalled();
})
