import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { brand, fonts, shadow } from '@/constants/brand'
// A light selectable pill for filters and choices, so only real actions use the solid button style.
export function ManagementChip({label,selected,onPress,disabled=false}:{label:string;selected:boolean;onPress:()=>void;disabled?:boolean}) {
 return <TouchableOpacity accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={{paddingVertical:8,paddingHorizontal:12,borderRadius:999,borderWidth:1,borderColor:selected?brand.primary:brand.line,backgroundColor:selected?brand.primarySoft:brand.card}}><Text style={{color:brand.ink,fontFamily:fonts.label,fontSize:14}}>{label}</Text></TouchableOpacity>
}
// A quiet text action, for secondary things like Edit, Cancel and Refresh.
export function ManagementLink({label,onPress,disabled=false,color=brand.primary}:{label:string;onPress:()=>void;disabled?:boolean;color?:string}) {
 return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{paddingVertical:6,opacity:disabled?0.5:1}}><Text style={{color,fontFamily:fonts.label,fontSize:15}}>{label}</Text></TouchableOpacity>
}
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
 buttonText:{color: brand.page,fontFamily:fonts.label,fontSize:15,textAlign:'center'},
 alert:{padding:14,backgroundColor:brand.zaytSoft,color: brand.zaytDeep,lineHeight:21,borderRadius:brand.radiusSmall,overflow:'hidden'},
})
