import { expect,it } from 'vitest'
import { knownAccountId } from '../lib/friends'
it('accepts a supplied UUID without account lookup and rejects contact searches or self requests',()=>{
 const id='AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA';expect(knownAccountId(' '+id+' ')).toBe(id.toLowerCase());expect(()=>knownAccountId('member@example.invalid')).toThrow('Email and name searches');expect(()=>knownAccountId('Friend Name')).toThrow('account ID');expect(()=>knownAccountId(id,id.toLowerCase())).toThrow('another account')
})
