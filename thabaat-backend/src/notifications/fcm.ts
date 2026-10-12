export type FcmMessage = { token: string; title: string; body: string; data?: Record<string,string> }
export type FcmConfig = { projectId: string; getAccessToken: () => Promise<string> }
// Tokens must be Firebase registration tokens, never Expo tokens or iOS APNs device tokens.
// OAuth access tokens are obtained only by server-side workload/service identity.
export async function sendFcm(config: FcmConfig | null, message: FcmMessage, request: typeof fetch = fetch): Promise<{status:'accepted'; id:string}> {
 if (!config || !/^[a-z][a-z0-9-]{4,62}$/.test(config.projectId)) throw new Error('FCM is not configured')
 if (!message.token || message.token.startsWith('ExponentPushToken[') || message.token.startsWith('ExpoPushToken[')) throw new Error('A Firebase registration token is required')
 const accessToken=await config.getAccessToken()
 if (!accessToken) throw new Error('FCM authentication unavailable')
 const response=await request(`https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`, {
  method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
  body:JSON.stringify({message:{token:message.token,notification:{title:message.title,body:message.body},data:message.data}}),signal:AbortSignal.timeout(5000)
 })
 if (!response.ok) throw new Error('FCM did not accept the notification')
 const result=await response.json() as {name?:unknown}
 if (typeof result.name!=='string' || !result.name.startsWith(`projects/${config.projectId}/messages/`)) throw new Error('Invalid FCM acceptance response')
 return {status:'accepted',id:result.name}
}
