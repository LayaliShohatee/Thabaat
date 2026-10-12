export const MAX_EVENT_IMAGE_BYTES=5*1024*1024
const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
export type EventImageAsset={uri:string;name?:string|null;mimeType?:string|null;size?:number|null;file?:Blob|null}
export function validateEventImage(asset:EventImageAsset,actualSize?:number){
 const mime=asset.mimeType??'',extension=types[mime]
 if(!extension)throw new Error('Choose a JPEG, PNG or WebP image.')
 const size=actualSize??asset.size??0
 if(size<12||size>MAX_EVENT_IMAGE_BYTES)throw new Error('Flyer images must be 5 MB or smaller.')
 return {mime,extension}
}
// Checks the real file signature so a renamed file cannot pass as an image.
export function validateEventImageHeader(bytes:Uint8Array,mime:string){
 const at=(i:number)=>bytes[i]
 const ok=mime==='image/jpeg'?at(0)===0xff&&at(1)===0xd8&&at(2)===0xff:mime==='image/png'?at(0)===0x89&&at(1)===0x50&&at(2)===0x4e&&at(3)===0x47:at(0)===0x52&&at(1)===0x49&&at(2)===0x46&&at(3)===0x46&&at(8)===0x57&&at(9)===0x45&&at(10)===0x42&&at(11)===0x50
 if(!ok)throw new Error('This file is not a valid image.')
}
export function eventImagePath(userId:string,extension:string,random:string){
 if(!/^[a-f0-9-]{36}$/.test(userId)||!/^[a-f0-9]{32}$/.test(random))throw new Error('Invalid upload path.')
 return `${userId}/${random}.${extension}`
}
