import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sendFcm} from '../src/notifications/fcm'
const config={projectId:'thabaat-test',getAccessToken:async()=>'fixture-oauth'}
const message={token:'fixture-firebase-registration',title:'Test',body:'Synthetic fixture',data:{eventId:'event'}}
test('FCM fails closed without config and rejects Expo token',async()=>{
 await assert.rejects(sendFcm(null,message),/not configured/)
 await assert.rejects(sendFcm(config,{...message,token:'ExponentPushToken[fixture]'}),/Firebase/)
})
test('FCM sends authorized HTTP v1 payload and reports acceptance only',async()=>{
 const result=await sendFcm(config,message,(async(url,options)=>{
  assert.equal(url,'https://fcm.googleapis.com/v1/projects/thabaat-test/messages:send')
  assert.deepEqual(options?.headers,{Authorization:'Bearer fixture-oauth','Content-Type':'application/json'})
  assert.deepEqual(JSON.parse(options!.body as string).message.token,message.token)
  return new Response(JSON.stringify({name:'projects/thabaat-test/messages/fixture'}),{status:200})
 }) as typeof fetch)
 assert.equal(result.status,'accepted')
})
test('FCM errors and malformed acknowledgements never imply delivery',async()=>{
 await assert.rejects(sendFcm(config,message,(async()=>new Response('{}',{status:403})) as typeof fetch),/did not accept/)
 await assert.rejects(sendFcm(config,message,(async()=>new Response('{}',{status:200})) as typeof fetch),/Invalid/)
})
