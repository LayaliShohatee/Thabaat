export const MAX_MEDIA_BYTES=100*1024*1024
export type MediaUploadAsset={name:string;size?:number;mimeType?:string;uri:string;file?:File}
export function validateMediaUpload(asset:MediaUploadAsset,size=asset.size) {
 const extension=asset.name.toLowerCase().split('.').pop()
 if(extension!=='mp4'&&extension!=='mov')throw new Error('Choose an MP4 or MOV video.')
 const mime=extension==='mov'?'video/quicktime':'video/mp4'
 if(asset.mimeType&&asset.mimeType!==mime)throw new Error('The video type does not match its filename.')
 if(!Number.isFinite(size)||Number(size)<12||Number(size)>MAX_MEDIA_BYTES)throw new Error('Choose a video between 12 bytes and 100 MiB.')
 return {extension,mime,size:Number(size)}
}
export function validateMediaHeader(bytes:Uint8Array) {
 if(bytes.length<12||String.fromCharCode(...bytes.slice(4,8))!=='ftyp')throw new Error('This file is not a supported MP4/MOV video container.')
}
export function mediaUploadPath(userId:string,extension:string,random:string) {
 if(!/^[a-f0-9-]{36}$/.test(userId)||!['mp4','mov'].includes(extension)||!/^[a-f0-9]{32}$/.test(random))throw new Error('Invalid media upload path.')
 return `${userId}/${random}.${extension}`
}
