import { useCallback } from 'react'
import { Text, View } from 'react-native'
import { PressableScale } from '@/components/PressableScale'
import { router } from 'expo-router'
import { useFocusResource } from '@/hooks/useFocusResource'
import { getCampaignData, openHostedCheckout } from '@/services/billingService'
import { money, type Campaign } from '@/lib/billing'
// Prompt shown after a free registration: the featured campaign (or first published one) with a one-tap donation.
export function pickSuggestedCampaign(campaigns:(Campaign&{featured?:boolean})[]){return campaigns.find(c=>c.featured&&c.checkout_url)??campaigns.find(c=>c.checkout_url)??null}
export default function SuggestedDonation({styles}:{styles:{subtitle:object;secondaryButton:object;secondaryButtonText:object}}) {
 const load=useCallback(async()=>{const {data,error}=await getCampaignData();if(error)throw new Error('Campaigns unavailable');return pickSuggestedCampaign(data||[])},[])
 const {data:campaign}=useFocusResource(load,null)
 return <View style={{alignItems:'center',width:'100%'}}>
  <Text style={styles.subtitle}>This event is free. A suggested donation helps keep Thabaat events running.</Text>
  {campaign&&<>
   <Text style={styles.subtitle}>Suggested: support “{campaign.name}”{campaign.goal_cents?` (goal ${money(campaign.goal_cents)})`:''}</Text>
   <PressableScale accessibilityRole="button" style={styles.secondaryButton} onPress={()=>void openHostedCheckout(campaign.checkout_url!)}><Text style={styles.secondaryButtonText}>Donate to {campaign.name}</Text></PressableScale>
  </>}
  <PressableScale accessibilityRole="button" style={styles.secondaryButton} onPress={() => router.push('/donations')}><Text style={styles.secondaryButtonText}>See all ways to give</Text></PressableScale>
 </View>
}
