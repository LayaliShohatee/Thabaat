import { beforeEach,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('@/lib/supabase',()=>({supabase:{rpc:mocks.rpc}}))
import { donationCsv,getDonationExport } from '../services/campaignAdminService'
const row=(id:string)=>({id,full_name:'=SUM(A1)',campaign:'Unattributed',description:'Local "quoted" record\nOnly',amount_cents:250,currency:'USD',paid_at:'2026-10-01T00:00:00Z',verified_at:'2026-10-02T00:00:00Z'})
beforeEach(()=>vi.clearAllMocks())
it('escapes CSV formula injection and multiline quotes without contact details',()=>{
 const csv=donationCsv([row('one')]);expect(csv).toContain('"\'=SUM(A1)"');expect(csv).toContain('Local ""quoted"" record\nOnly');expect(csv).not.toContain('email');expect(csv).not.toContain('phone')
})
it('retrieves subsequent pages and rejects changed or oversized reports',async()=>{
 mocks.rpc.mockResolvedValueOnce({data:{records:[row('one')],total:2},error:null}).mockResolvedValueOnce({data:{records:[row('two')],total:2},error:null});expect((await getDonationExport('2026-10-03T00:00:00Z')).map(r=>r.id)).toEqual(['one','two']);expect(mocks.rpc).toHaveBeenLastCalledWith('admin_donation_report',{p_before:'2026-10-03T00:00:00Z',p_offset:1});
 mocks.rpc.mockResolvedValueOnce({data:{records:[row('one')],total:2},error:null}).mockResolvedValueOnce({data:{records:[row('two')],total:3},error:null});await expect(getDonationExport('2026-10-03T00:00:00Z')).rejects.toThrow('changed');
 mocks.rpc.mockResolvedValueOnce({data:{records:[],total:10001},error:null});await expect(getDonationExport('2026-10-03T00:00:00Z')).rejects.toThrow('10,000')
})
