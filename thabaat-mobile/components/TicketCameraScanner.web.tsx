import { Text } from 'react-native'
import { managementStyles as styles } from '@/components/ManagementUI'
export default function TicketCameraScanner(_props:{paused:boolean;onScan:(data:string)=>void}) {
 return <Text style={styles.alert}>Use manual ticket entry in the browser. Camera scanning is available in the iPhone/Android app.</Text>
}
