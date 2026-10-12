import {beforeEach,expect,it,vi} from 'vitest'
import {chooseMediaVideo,uploadMediaVideo} from '../services/mediaUploadService'
const mocks=vi.hoisted(()=>({picker:vi.fn(),permissions:vi.fn(),upload:vi.fn(),bytes:vi.fn(),remove:vi.fn()}))
vi.mock('react-native',()=>({Platform:{OS:'ios'}}))
vi.mock('expo-document-picker',()=>({getDocumentAsync:mocks.picker}))
vi.mock('expo-file-system',()=>({File:class {exists=true;bytes=mocks.bytes;delete=mocks.remove}}))
vi.mock('../services/managementService',()=>({getPermissions:mocks.permissions}))
vi.mock('../lib/supabase',()=>({supabase:{storage:{from:()=>({upload:mocks.upload})}}}))
const asset={name:'synthetic.mp4',size:12,mimeType:'video/mp4',uri:'file://synthetic-cache'}
beforeEach(()=>{vi.clearAllMocks();mocks.permissions.mockResolvedValue({can_manage_events:true,staff_role:'organizer',user_id:'00000000-0000-0000-0000-000000000001'});mocks.bytes.mockResolvedValue(new Uint8Array([0,0,0,12,102,116,121,112,0,0,0,0]));mocks.upload.mockResolvedValue({error:null})})
it('picker cancellation creates no upload or media metadata',async()=>{mocks.picker.mockResolvedValue({canceled:true});expect(await chooseMediaVideo()).toBeNull();expect(mocks.upload).not.toHaveBeenCalled()})
it('denied role is checked before reading or transmitting any file bytes',async()=>{mocks.permissions.mockResolvedValue({can_manage_events:false,staff_role:'volunteer'});await expect(uploadMediaVideo(asset)).rejects.toThrow('Organizer');expect(mocks.bytes).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled()})
it('invalid binary content never reaches private storage',async()=>{mocks.bytes.mockResolvedValue(new Uint8Array(12));await expect(uploadMediaVideo(asset)).rejects.toThrow('container');expect(mocks.upload).not.toHaveBeenCalled();expect(mocks.remove).not.toHaveBeenCalled()})
it('failed upload retains selected cache for retry; successful retry uses private non-overwriting upload then cleans cache',async()=>{mocks.upload.mockResolvedValueOnce({error:{message:'unavailable'}});await expect(uploadMediaVideo(asset)).rejects.toThrow('retry');expect(mocks.remove).not.toHaveBeenCalled();const path=await uploadMediaVideo(asset);expect(path).toMatch(/^00000000-0000-0000-0000-000000000001\/[a-f0-9]{32}\.mp4$/);expect(mocks.upload).toHaveBeenLastCalledWith(path,expect.any(ArrayBuffer),{contentType:'video/mp4',upsert:false});expect(mocks.remove).toHaveBeenCalledOnce()})
