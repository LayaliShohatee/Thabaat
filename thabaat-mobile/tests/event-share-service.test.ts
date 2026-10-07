import {afterEach,expect,it,vi} from 'vitest'
const share=vi.hoisted(()=>vi.fn())
vi.mock('react-native',()=>({Share:{share,dismissedAction:'dismissedAction'}}))
import {shareEventLink} from '../services/eventShareService'
import {shareEventLink as shareWeb} from '../services/eventShareService.web'
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals()})
it('native dismissed share does not claim a recipient or completed delivery',async()=>{
 share.mockResolvedValue({action:'dismissedAction'})
 expect(await shareEventLink('thabaat://event/fixture')).toBe('Sharing cancelled.')
 expect(share).toHaveBeenCalledWith({title:'Thabaat event',message:'View this Thabaat event (sign-in required): thabaat://event/fixture',url:'thabaat://event/fixture'})
})
it('web app-only sharing copies link without opening external apps',async()=>{
 const copy=vi.fn(),webShare=vi.fn();vi.stubGlobal('navigator',{share:webShare,clipboard:{writeText:copy}})
 expect(await shareWeb('thabaat://event/fixture')).toContain('Link copied')
 expect(copy).toHaveBeenCalledWith('thabaat://event/fixture');expect(webShare).not.toHaveBeenCalled()
})
it('web chooser dismissal is truthful and clipboard refusal remains recoverable',async()=>{
 const error=new Error('cancel');error.name='AbortError';vi.stubGlobal('navigator',{share:vi.fn().mockRejectedValue(error)})
 expect(await shareWeb('https://approved.example.invalid/event/fixture')).toBe('Sharing cancelled.')
 vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}})
 await expect(shareWeb('thabaat://event/fixture')).rejects.toThrow('copy the displayed link')
})
