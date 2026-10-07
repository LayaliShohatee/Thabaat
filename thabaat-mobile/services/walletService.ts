import { Platform } from 'react-native'
import * as fs from 'expo-file-system'
import * as sharing from 'expo-sharing'
import { supabase } from '@/lib/supabase'
import { PASS_MIME, readWalletPass, walletError } from '@/lib/wallet-pass'
async function request(path: string, signal?: AbortSignal, registrationId?: string) {
 const backend = process.env.EXPO_PUBLIC_BACKEND_URL
 if (!backend) throw new Error(walletError(503))
 const {data,error} = await supabase.auth.getSession()
 if (error || !data.session) throw new Error(walletError(401))
 return fetch(`${backend.replace(/\/$/,'')}/wallet/${path}`, {
  method: registrationId ? 'POST' : 'GET', signal: signal ?? AbortSignal.timeout(15000),
  headers: {Authorization: `Bearer ${data.session.access_token}`, ...(registrationId ? {'Content-Type':'application/json'} : {})},
  ...(registrationId ? {body: JSON.stringify({registrationId})} : {}),
 })
}
export async function getWalletAvailability(signal?: AbortSignal): Promise<boolean> {
 if (Platform.OS !== 'ios') return false
 const response = await request('status', signal)
 if (response.status === 503) return false
 if (!response.ok) throw new Error(walletError(response.status))
 const result = await response.json()
 return result.available === true
}
export async function openWalletPass(registrationId: string, signal?: AbortSignal) {
 if (Platform.OS !== 'ios') throw new Error('Apple Wallet passes can be opened on an iPhone.')
 const bytes = await readWalletPass(await request('pass', signal, registrationId))
 if (signal?.aborted) throw new Error('Wallet request canceled.')
 if (!await sharing.isAvailableAsync()) throw new Error('The system file sheet is unavailable on this device.')
 if (signal?.aborted) throw new Error('Wallet request canceled.')
 const file = new fs.File(fs.Paths.cache, `thabaat-${Date.now()}.pkpass`)
 try {
  file.create({overwrite:true}); file.write(bytes)
  await sharing.shareAsync(file.uri, {mimeType:PASS_MIME,UTI:'com.apple.pkpass',dialogTitle:'Open your signed Apple Wallet pass'})
 } finally { if (file.exists) file.delete() }
}
