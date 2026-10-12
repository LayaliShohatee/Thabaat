import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import type { MediaItem } from '@/lib/media'
import { safeProgress } from '@/lib/media'
import { getMediaPlayback, getMediaProgress, saveMediaProgress } from '@/services/mediaService'

// HTML media lifecycle avoids Expo's web adapter resetting a pre-metadata seek.
export default function MediaPlayer({item}:{item:MediaItem}) {
 const video=useRef<HTMLVideoElement>(null)
 const resume=useRef(0),playing=useRef(false),lastSave=useRef(0),ready=useRef(false)
 const [source,setSource]=useState(''),[message,setMessage]=useState('Loading secure playback…')
 useEffect(()=>{
  const mountedVideo=video.current
  ready.current=false
  let active=true,pending=false,denied=false
  async function load(initial=false){
   if(!active||pending||denied||(!initial&&!ready.current))return
   pending=true
   try{
    const uri=await getMediaPlayback(item)
    const seconds=initial?await getMediaProgress(item.id):video.current?.currentTime??0
    if(!active)return
    resume.current=seconds;playing.current=initial?false:!!video.current&&!video.current.paused
    setSource(uri);setMessage('')
   }catch(error){if(active){denied=true;video.current?.pause();video.current?.removeAttribute('src');video.current?.load();setSource('');setMessage(error instanceof Error?error.message:'Playback unavailable.')}}
   finally{pending=false}
  }
  void load(true)
  const interval=setInterval(()=>{void load()},45000)
  const visibility=()=>{if(document.hidden)video.current?.pause();else void load()}
  document.addEventListener('visibilitychange',visibility)
  return()=>{active=false;clearInterval(interval);document.removeEventListener('visibilitychange',visibility);mountedVideo?.pause()}
 },[item])
 return <View>
  <video ref={video} src={source||undefined} controls playsInline preload="metadata" style={{width:'100%',height:240}} controlsList="nodownload noremoteplayback" disablePictureInPicture
   onLoadedMetadata={event=>{
    event.currentTarget.currentTime=safeProgress(resume.current,event.currentTarget.duration)
    ready.current=true
    if(resume.current>0)setMessage(`Resumed at ${Math.floor(resume.current)} seconds.`)
    if(playing.current)void event.currentTarget.play().catch(()=>setMessage('Press Play to continue.'))
   }}
   onTimeUpdate={event=>{
    const element=event.currentTarget
    if(element.paused||Math.abs(element.currentTime-lastSave.current)<10)return
    lastSave.current=element.currentTime
    void saveMediaProgress(item.id,safeProgress(element.currentTime,element.duration)).catch(()=>setMessage('Progress could not be saved.'))
   }}
   onError={()=>{if(source)setMessage('Video could not play. Close and reopen to retry.')}}/>
  {!!message&&<Text accessibilityLiveRegion="polite" style={{color:'#ddd',padding:12}}>{message}</Text>}
 </View>
}
