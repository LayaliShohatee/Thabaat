import { StyleSheet, Text } from 'react-native'
import { PressableScale } from './PressableScale'
import { brand, fonts, shadow } from '@/constants/brand'
// A light selectable pill for filters and choices, so only real actions use the solid button style.
export function ManagementChip({label,selected,onPress,disabled=false}:{label:string;selected:boolean;onPress:()=>void;disabled?:boolean}) {
 return <PressableScale accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} haptic="selection" hitSlop={{top:6,bottom:6,left:2,right:2}} style={{paddingVertical:8,paddingHorizontal:12,borderRadius:999,borderWidth:1,borderColor:selected?brand.primary:brand.line,backgroundColor:selected?brand.primarySoft:brand.card}}><Text style={{color:brand.ink,fontFamily:fonts.label,fontSize:14}}>{label}</Text></PressableScale>
}
// A quiet text action, for secondary things like Edit, Cancel and Refresh.
export function ManagementLink({label,onPress,disabled=false,color=brand.primary,center=false}:{label:string;onPress:()=>void;disabled?:boolean;color?:string;center?:boolean}) {
 return <PressableScale accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={10} style={{paddingVertical:6,alignSelf:center?'center':'flex-start'}}><Text style={{color,fontFamily:fonts.label,fontSize:15}}>{label}</Text></PressableScale>
}
export function ManagementButton({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
 return <PressableScale accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={onPress} style={managementStyles.button}><Text style={managementStyles.buttonText}>{label}</Text></PressableScale>
}
export const managementStyles=StyleSheet.create({
 page:{flex:1,backgroundColor:brand.page},
 content:{padding:20,paddingTop:64,paddingBottom:48,gap:14,maxWidth:760,width:'100%',alignSelf:'center'},
 title:{fontSize:28,fontFamily:fonts.headingHeavy,color:brand.ink,letterSpacing:-0.4},
 heading:{fontSize:17,fontFamily:fonts.heading,color:brand.ink,letterSpacing:-0.2},
 text:{fontSize:15,lineHeight:22,color:brand.inkMuted},
 card:{padding:18,backgroundColor:brand.card,borderRadius:brand.radius,gap:12,borderWidth:1,borderColor:brand.line,...shadow},
 input:{backgroundColor:brand.card,borderWidth:1,borderColor:brand.line,paddingVertical:13,paddingHorizontal:14,borderRadius:brand.radiusSmall,fontSize:16,color:brand.ink},
 button:{backgroundColor:brand.primary,paddingVertical:14,paddingHorizontal:18,borderRadius:999,alignItems:'center'},
 buttonText:{color:'#FFFFFF',fontFamily:fonts.label,fontSize:15,textAlign:'center'},
 alert:{padding:14,backgroundColor:brand.goldSoft,color:'#6B4A0F',lineHeight:21,borderRadius:brand.radiusSmall,overflow:'hidden'},
})
