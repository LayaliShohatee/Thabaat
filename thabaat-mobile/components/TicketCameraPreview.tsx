import { useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { ManagementButton as Button, managementStyles as styles } from '@/components/ManagementUI'
export default function TicketCameraPreview({paused,onScan,onClose}:{paused:boolean;onScan:(data:string)=>void;onClose:()=>void}) {
 const [permission,request]=useCameraPermissions()
 const [error,setError]=useState('')
 if(error)return <View style={styles.card}><Text style={styles.alert}>{error}</Text><Button label="Use manual ticket entry" onPress={onClose}/></View>
 if(!permission)return <Text style={styles.text}>Checking camera permission…</Text>
 if(!permission.granted)return <View style={styles.card}><Text style={styles.text}>Camera access is optional. Allow it to scan ticket QR codes, or use manual entry below.</Text>{permission.canAskAgain?<Button label="Allow camera" onPress={()=>{void request().catch(()=>setError('Camera permission could not be requested. Use manual ticket entry.'))}}/>:<><Text style={styles.alert}>Camera permission is denied. Enable it in device Settings to scan, or keep using manual entry.</Text><Button label="Open device Settings" onPress={()=>{void Linking.openSettings().catch(()=>setError('Device Settings could not open. Use manual ticket entry.'))}}/></>}<Button label="Use manual ticket entry" onPress={onClose}/></View>
 return <View style={styles.card}>{!paused?<CameraView style={{height:260,borderRadius:12}} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={event=>onScan(event.data)} onMountError={()=>setError('Camera could not start. Use manual ticket entry, or reopen the scanner.')} />:<Text style={styles.text}>Scanner paused while validating a ticket or showing an accepted check-in.</Text>}<Button label="Close camera" onPress={onClose}/></View>
}
