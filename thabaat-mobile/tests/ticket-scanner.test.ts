import {expect,it} from 'vitest'
import {createTicketScanGate} from '../lib/ticket-scanner'
const token='a'.repeat(64)
it('accepts only opaque ticket credentials, never links or personal data',()=>{
 for(const value of ['https://example.invalid/ticket?user=email','someone@example.invalid','{"name":"Person"}','a'.repeat(63),'A'.repeat(64)])expect(createTicketScanGate().accept(value,0)).toEqual({status:'invalid'})
 expect(createTicketScanGate().accept(` ${token} `,0)).toEqual({status:'accepted',token})
})
it('closes synchronously so repeated frames cannot issue parallel check-ins',()=>{
 const gate=createTicketScanGate();expect(gate.accept(token,0).status).toBe('accepted');expect(gate.accept(token,1).status).toBe('ignored');expect(gate.reset()).toBe(false)
})
it('accepted and repeat-accepted results require explicit next-ticket action',()=>{
 const gate=createTicketScanGate();gate.accept(token,0);gate.complete(true,10)
 expect(gate.accept(token,10000).status).toBe('ignored');expect(gate.reset()).toBe(true);expect(gate.accept('b'.repeat(64),10001).status).toBe('accepted')
})
it('server denial or outage resumes after a short cooldown without recording attendance',()=>{
 const gate=createTicketScanGate();gate.accept(token,0);gate.complete(false,10)
 expect(gate.accept(token,1000).status).toBe('ignored');expect(gate.accept(token,1510).status).toBe('accepted')
})
it('invalid QR recovers without displaying or passing its payload to the server',()=>{
 const gate=createTicketScanGate();expect(gate.accept('private unrelated QR',0)).toEqual({status:'invalid'});expect(gate.accept(token,1).status).toBe('ignored');expect(gate.accept(token,1500)).toEqual({status:'accepted',token})
})
