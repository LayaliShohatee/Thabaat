import { useEffect, useState } from 'react'
import { AppState, Platform, Text, View } from 'react-native'
import { useVideoPlayer, VideoView, VideoAirPlayButton } from 'expo-video'
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
  const app=AppState.addEventListener('change',state=>{if(state!=='active'){player.pause()}else{void open()}})
  return()=>{active=false;clearInterval(interval);progress.remove();status.remove();loaded.remove();app.remove();player.pause()}
 },[item,player])
 return <View>
  <VideoView player={player} style={{width:'100%',height:240}} nativeControls fullscreenOptions={{enable:true}} allowsPictureInPicture startsPictureInPictureAutomatically/>
  {Platform.OS==='ios'&&!message&&<View style={{flexDirection:'row',alignItems:'center',gap:12}}><VideoAirPlayButton accessibilityLabel="Choose AirPlay device" tint="#fff" activeTint="#4ade80" style={{width:44,height:44}}/><Text style={{color:'#bbb',flex:1}}>AirPlay device picker. Playback continues in the background and in picture-in-picture when you leave the app.</Text></View>}
  {!!message&&<Text accessibilityLiveRegion="polite" style={{color:'#ddd',padding:12}}>{message}</Text>}
 </View>
}
