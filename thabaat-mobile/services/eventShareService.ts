import {Share} from 'react-native'
import {eventShareMessage} from '@/lib/event-sharing'
export async function shareEventLink(url:string):Promise<string>{
 const result=await Share.share({message:eventShareMessage(url),url,title:'Thabaat event'})
 return result.action===Share.dismissedAction?'Sharing cancelled.':'Share action completed. Recipient access still requires sign-in.'
}
