import {eventShareMessage} from '@/lib/event-sharing'
export async function shareEventLink(url:string):Promise<string>{
 if(typeof navigator!=='undefined'&&navigator.share&&url.startsWith('https://')){
  try{await navigator.share({title:'Thabaat event',text:eventShareMessage(url),url});return'Share action completed. Recipient access still requires sign-in.'}
  catch(error){if(error instanceof Error&&error.name==='AbortError')return'Sharing cancelled.';throw new Error('Sharing could not open. Copy the displayed link and try again.')}
 }
 if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url);return'Link copied. Paste it wherever you choose.'}catch{throw new Error('Clipboard unavailable. You can copy the displayed link.') }}
 return'Copy the displayed link to share this event.'
}
