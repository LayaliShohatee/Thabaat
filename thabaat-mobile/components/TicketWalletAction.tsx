import { useCallback, useRef, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
import { getWalletAvailability, openWalletPass } from '@/services/walletService'
import { createWalletActionGate } from '@/lib/wallet-pass'
export function TicketWalletAction({registrationId}:{registrationId:string}) {
 const [available,setAvailable]=useState(false)
 const [loading,setLoading]=useState(false)
 const [message,setMessage]=useState('')
 const [retry,setRetry]=useState(0)
 const controller=useRef<AbortController|null>(null)
 const gate=useRef(createWalletActionGate())
 useFocusEffect(useCallback(()=>{
  const abort=new AbortController();controller.current=abort
  setAvailable(false);setMessage('');setLoading(true)
  void getWalletAvailability(abort.signal).then(value=>{if(!abort.signal.aborted)setAvailable(value)}).catch(error=>{if(!abort.signal.aborted)setMessage(error instanceof Error?error.message:'Wallet availability could not load.')}).finally(()=>{if(!abort.signal.aborted)setLoading(false)})
  return ()=>{abort.abort();controller.current=null}
 // Recheck when the ticket changes or the user explicitly retries; cancel the prior request.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[registrationId,retry]))
 async function open() {
  const signal=controller.current?.signal
  if(!signal || signal.aborted || !available || !gate.current.start())return
  setLoading(true);setMessage('')
  try {
   await openWalletPass(registrationId,signal)
   if(!signal.aborted)setMessage('The system pass sheet has closed. Check Wallet to confirm whether you added the pass. Your event QR remains available.')
  } catch(error) {
   if(!signal.aborted){setMessage(error instanceof Error?error.message:'Unable to open your pass.');setAvailable(false)}
  } finally {gate.current.finish();if(!signal.aborted)setLoading(false)}
 }
 return <View style={styles.card}>
  <Text style={styles.heading}>Apple Wallet</Text>
  <Text style={styles.text}>{Platform.OS!=='ios'?'Open your ticket in the iPhone app to use Apple Wallet.':loading?'Checking Wallet availability…':available?'Open the signed pass with the iPhone system sheet. You choose whether to add it to Wallet.':'Apple Wallet signing is unavailable on this environment. Use your event QR for check-in.'}</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
  {available&&<Button label={loading?'Opening pass…':'Add to Apple Wallet'} disabled={loading} onPress={()=>void open()}/>}
  {Platform.OS==='ios'&&!available&&<Button label="Check Wallet availability again" disabled={loading} onPress={()=>setRetry(value=>value+1)}/>}
 </View>
}
