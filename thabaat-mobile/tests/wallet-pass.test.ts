import {expect,it} from 'vitest'
import {createWalletActionGate,PASS_MIME,readWalletPass,walletError} from '../lib/wallet-pass'
it('reports unavailable signing without exposing server internals',async()=>{
 await expect(readWalletPass(new Response('secret',{status:503}))).rejects.toThrow('not configured')
 expect(walletError(403)).toContain('no longer eligible')
 expect(walletError(401)).toContain('Sign in again')
})
it('accepts only pkpass binary ZIP responses',async()=>{
 await expect(readWalletPass(new Response('{"pass":true}',{headers:{'Content-Type':PASS_MIME}}))).rejects.toThrow('invalid pass')
 await expect(readWalletPass(new Response(new Uint8Array([80,75,3,4]),{headers:{'Content-Type':'application/json'}}))).rejects.toThrow('invalid pass')
 expect(await readWalletPass(new Response(new Uint8Array([80,75,3,4]),{headers:{'Content-Type':PASS_MIME}}))).toEqual(new Uint8Array([80,75,3,4]))
})
it('serializes repeated sheet actions and permits retry after cancellation/error',()=>{
 const gate=createWalletActionGate();expect(gate.start()).toBe(true);expect(gate.start()).toBe(false)
 gate.finish();expect(gate.start()).toBe(true);gate.finish();expect(gate.start()).toBe(true)
})
