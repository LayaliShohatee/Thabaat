import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { brand, fonts, shadow } from '@/constants/brand'
export function ManagementButton({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
 return <TouchableOpacity accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={onPress} style={[managementStyles.button,disabled&&{opacity:0.5}]}><Text style={managementStyles.buttonText}>{label}</Text></TouchableOpacity>
}
export const managementStyles=StyleSheet.create({
 page:{flex:1,backgroundColor:brand.page},
 content:{padding:20,paddingTop:64,paddingBottom:48,gap:14,maxWidth:760,width:'100%',alignSelf:'center'},
 title:{fontSize:28,fontFamily:fonts.headingHeavy,color:brand.ink,letterSpacing:-0.3},
 heading:{fontSize:17,fontFamily:fonts.heading,color:brand.ink},
 text:{fontSize:15,lineHeight:22,color:brand.inkMuted},
 card:{padding:18,backgroundColor:brand.card,borderRadius:brand.radius,gap:12,borderWidth:1,borderColor:brand.line,...shadow},
 input:{backgroundColor:brand.card,borderWidth:1,borderColor:brand.line,paddingVertical:13,paddingHorizontal:14,borderRadius:brand.radiusSmall,fontSize:16,color:brand.ink},
 button:{backgroundColor:brand.primary,paddingVertical:14,paddingHorizontal:18,borderRadius:999,alignItems:'center'},
 buttonText:{color:'#FFFFFF',fontFamily:fonts.label,fontSize:15,textAlign:'center'},
 alert:{padding:14,backgroundColor:brand.goldSoft,color:'#6B4A0F',lineHeight:21,borderRadius:brand.radiusSmall,overflow:'hidden'},
})
