import { useEffect, useState } from 'react'
import { AppState, Platform, Text, View } from 'react-native'
import { useVideoPlayer, VideoView, VideoAirPlayButton } from 'expo-video'
import { CastButton, useRemoteMediaClient } from 'react-native-google-cast'
import type { MediaItem } from '@/lib/media'
import { safeProgress } from '@/lib/media'
import { getMediaPlayback, getMediaProgress, saveMediaProgress } from '@/services/mediaService'

export default function MediaPlayer({ item }: { item: MediaItem }) {
 const [message,setMessage]=useState('Loading secure playback…')
 const player=useVideoPlayer(null,p=>{p.timeUpdateEventInterval=10;p.staysActiveInBackground=true;p.showNowPlayingNotification=true;p.allowsExternalPlayback=true})
 useEffect(()=>{
  let active=true, refreshing=false, denied=false, ready=false, pendingPosition=0, resumePlaying=false
  const stop=(text:string)=>{if(!active)return;denied=true;player.pause();void player.replaceAsync(null);setMessage(text)}
  async function open(initial=false) {
   if(refreshing || !active || denied || (!initial && !ready))return
   refreshing=true
   try {
    const uri=await getMediaPlayback(item)
    const position=initial?await getMediaProgress(item.id):player.currentTime
    if(!active)return
    resumePlaying=player.playing
    pendingPosition=position;ready=false
    await player.replaceAsync({uri,useCaching:false})
    if(!active)return
    setMessage('')
   }catch(error){stop(error instanceof Error?error.message:'Playback could not load.')}
   finally{refreshing=false}
  }
  const loaded=player.addListener('sourceLoad',({duration})=>{
   if(!active||denied)return
   player.currentTime=safeProgress(pendingPosition,duration);ready=true
   if(resumePlaying)player.play()
  })
  void open(true)
  const interval=setInterval(()=>{void open()},45000)
  const progress=player.addListener('timeUpdate',({currentTime})=>{
   if(!active||denied||refreshing||!ready||!player.playing)return
   void saveMediaProgress(item.id,safeProgress(currentTime,player.duration)).catch(()=>{if(active)setMessage('Progress could not be saved. Playback will recheck access shortly.')})
  })
  const status=player.addListener('statusChange',({status,error})=>{
   if(!active||denied)return
   if(status==='readyToPlay'&&!ready){player.currentTime=safeProgress(pendingPosition,player.duration);ready=true;if(resumePlaying)player.play();else player.pause()}
   if(status==='error')setMessage(error?.message??'Video could not play. Close and reopen to retry.')
  })
  // Keep playing in the background / picture-in-picture; refresh the signed URL when the app returns.
  const app=AppState.addEventListener('change',state=>{if(state==='active')void open()})
  return()=>{active=false;clearInterval(interval);progress.remove();status.remove();loaded.remove();app.remove();player.pause()}
 },[item,player])
 // Chromecast: once a cast session connects, play this video on the TV from the current position and pause the phone.
 const castClient=useRemoteMediaClient()
 useEffect(()=>{
  if(!castClient)return
  let cancelled=false
  void getMediaPlayback(item,'cast').then(uri=>{
   if(cancelled)return
   player.pause()
   return castClient.loadMedia({mediaInfo:{contentUrl:uri,contentType:item.object_path?.endsWith('.mov')?'video/quicktime':'video/mp4',metadata:{type:'movie',title:item.title}},startTime:player.currentTime})
  }).then(()=>{if(!cancelled)setMessage('Playing on your Chromecast.')}).catch(()=>{if(!cancelled)setMessage('Could not start Chromecast playback. Try again.')})
  return()=>{cancelled=true}
 },[castClient,item,player])
 return <View>
  <VideoView player={player} style={{width:'100%',height:240}} nativeControls fullscreenOptions={{enable:true}} allowsPictureInPicture startsPictureInPictureAutomatically/>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   {Platform.OS==='ios'&&<VideoAirPlayButton accessibilityLabel="Choose AirPlay device" tint="#0F4C3A" activeTint="#D9A441" style={{width:44,height:44}}/>}
   <CastButton accessibilityLabel="Choose Chromecast device" style={{width:44,height:44,tintColor:'#0F4C3A'}}/>
   <Text style={{color:'#53635E',flex:1}}>Watch on a TV with AirPlay or Chromecast. Playback continues in the background and in picture-in-picture.</Text>
  </View>
  {!!message&&<Text accessibilityLiveRegion="polite" style={{color:'#ddd',padding:12}}>{message}</Text>}
 </View>
}
