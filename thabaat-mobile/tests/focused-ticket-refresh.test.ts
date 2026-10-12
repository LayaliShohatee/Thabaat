import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const harness=vi.hoisted(()=>({slots:[] as {writes:any[]}[],cleanup:null as null|(()=>void),listener:null as null|((state:string)=>void),app:{currentState:'active'},remove:vi.fn()}))
vi.mock('react',()=>({useCallback:(fn:any)=>fn,useRef:(value:any)=>({current:value}),useState:(value:any)=>{const slot={writes:[] as any[]};harness.slots.push(slot);return[value,(next:any)=>slot.writes.push(next)]}}))
vi.mock('expo-router',()=>({useFocusEffect:(fn:any)=>{harness.cleanup=fn()}}))
vi.mock('react-native',()=>({AppState:{get currentState(){return harness.app.currentState},addEventListener:(_event:string,fn:any)=>{harness.listener=fn;return {remove:harness.remove}}}}))
import {useFocusResource} from '../hooks/useFocusResource'
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();harness.slots=[];harness.app.currentState='active';harness.cleanup=null;harness.listener=null})
afterEach(()=>{harness.cleanup?.();vi.useRealTimers()})
it('updates an open ticket quietly, skips background polling, resumes on foreground and stops on blur',async()=>{
 const loader=vi.fn().mockResolvedValueOnce({checked_in_at:null}).mockResolvedValue({checked_in_at:'saved-server-time'})
 useFocusResource(loader,null,5000);await Promise.resolve();await Promise.resolve()
 await vi.advanceTimersByTimeAsync(5000)
 expect(harness.slots[0].writes.at(-1)).toEqual({checked_in_at:'saved-server-time'})
 expect(harness.slots[1].writes.filter(value=>value===true)).toHaveLength(1)
 harness.app.currentState='background';await vi.advanceTimersByTimeAsync(10000);expect(loader).toHaveBeenCalledTimes(2)
 harness.app.currentState='active';harness.listener?.('active');await Promise.resolve();expect(loader).toHaveBeenCalledTimes(3)
 harness.cleanup?.();harness.cleanup=null;await vi.advanceTimersByTimeAsync(10000);expect(loader).toHaveBeenCalledTimes(3);expect(harness.remove).toHaveBeenCalledOnce()
})
it('does not overlap slow refreshes or apply a response after leaving the ticket',async()=>{
 let finish:(value:any)=>void=()=>{};const loader=vi.fn(()=>new Promise(resolve=>{finish=resolve}))
 useFocusResource(loader,null,5000);await vi.advanceTimersByTimeAsync(15000);expect(loader).toHaveBeenCalledOnce()
 harness.cleanup?.();harness.cleanup=null;finish({checked_in_at:'stale'});await Promise.resolve();await Promise.resolve()
 expect(harness.slots[0].writes).toEqual([])
})
