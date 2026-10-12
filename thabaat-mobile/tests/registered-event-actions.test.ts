import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {beforeEach,expect,it,vi} from 'vitest'
import Actions from '../components/events/RegisteredEventActions'
import Confirmation from '../app/registration/confirmation'
import MyEvents from '../app/(tabs)/my-events'
import Ticket from '../app/ticket/[id]'
import Roster from '../components/EventAttendanceRoster'
const state=vi.hoisted(()=>({params:{} as Record<string,string>,data:null as any,error:'',loading:false,buttons:[] as any[],push:vi.fn(),reload:vi.fn()}))
vi.mock('react-native',()=>({
 View:({children}:any)=>React.createElement('div',null,children),ScrollView:({children}:any)=>React.createElement('div',null,children),Text:({children}:any)=>React.createElement('span',null,children),
 TouchableOpacity:(props:any)=>{state.buttons.push(props);return React.createElement('button',null,props.children)},
 FlatList:({data,renderItem,ListHeaderComponent,ListEmptyComponent}:any)=>React.createElement('div',null,ListHeaderComponent,data.length?data.map((item:any)=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))):ListEmptyComponent),
 StyleSheet:{create:(styles:any)=>styles},ActivityIndicator:()=>null,
}))
vi.mock('expo-router',()=>({router:{push:state.push,replace:vi.fn()},useLocalSearchParams:()=>state.params,Stack:{Screen:()=>null}}))
vi.mock('../hooks/useFocusResource',()=>({useFocusResource:()=>({...state,reload:state.reload})}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{id:'user'}})}))
vi.mock('../services/eventService',()=>({getEventById:vi.fn()}))
vi.mock('../services/ticketService',()=>({getMyTicket:vi.fn()}))
vi.mock('../services/registrationService',()=>({cancelFreeRegistration:vi.fn(),getUserRegistrations:vi.fn()}))
vi.mock('../components/ManagementUI',()=>({managementStyles:{},ManagementButton:({label,onPress}:any)=>{state.buttons.push({label,onPress});return React.createElement('button',null,label)}}))
vi.mock('../components/events/CalendarActions',()=>({default:({event}:any)=>React.createElement('div',{'data-event':event.id},'Add to calendar')}))
vi.mock('../components/SuggestedDonation',()=>({default:()=>React.createElement('div',null,'Suggested donation')}))
vi.mock('../services/refundDiscountService',()=>({requestRefund:vi.fn()}))
vi.mock('../components/TicketWalletAction',()=>({TicketWalletAction:({registrationId}:any)=>React.createElement('div',{'data-registration':registrationId},'Apple Wallet signing unavailable; use event QR')}))
vi.mock('react-native-qrcode-svg',()=>({default:()=>React.createElement('div',null,'Ticket QR')}))
const render=(component:any)=>renderToStaticMarkup(React.createElement(component))
beforeEach(()=>{state.params={eventId:'event-1',registrationId:'registration-1',eventTitle:'Synthetic event',notificationSent:'false'};state.data={id:'event-1',event_id:'event-1',registration_id:'registration-1',title:'Synthetic event',event_date:'2030-01-01',token:'a'.repeat(64)};state.error='';state.loading=false;state.buttons=[];vi.clearAllMocks()})
it('confirmation offers both actions for the saved registration despite unavailable Wallet',()=>{
 const html=render(Confirmation);expect(html).toContain('Registered!');expect(html).toContain('Your registration is saved');expect(html).toContain('Add to calendar');expect(html).toContain('data-event="event-1"');expect(html).toContain('data-registration="registration-1"');expect(html).toContain('Wallet signing unavailable');expect(html).toContain('View My Events')
})
it('offline calendar loading preserves confirmation, Wallet and retry',()=>{
 state.error='offline';state.data=null
 const html=render(Confirmation);expect(html).toContain('Registered!');expect(html).toContain('Your registration remains saved');expect(html).toContain('Wallet signing unavailable');expect(html).not.toContain('Add to calendar')
 state.buttons.find(button=>button.label==='Retry calendar details').onPress();expect(state.reload).toHaveBeenCalledOnce()
})
it('calendar loading is visible and does not hide the Wallet alternative',()=>{
 state.data=null;state.loading=true
 const html=renderToStaticMarkup(React.createElement(Actions,{eventId:'event-1',registrationId:'registration-1'}));expect(html).toContain('Loading calendar details');expect(html).toContain('data-registration="registration-1"')
})
it('confirmed My Events card and explicit ticket button open the registered ticket; canceled rows cannot',()=>{
 state.data=[{id:'registration-1',event_id:'event-1',status:'confirmed',event:{title:'Synthetic event',event_date:'2030-01-01'},ticket_type:{name:'Free',price:0}},{id:'cancelled-1',event_id:'event-2',status:'cancelled',event:{title:'Canceled event',event_date:'2030-01-01'}}]
 expect(render(MyEvents)).toContain('Open ticket')
 for(const button of state.buttons.filter(button=>renderToStaticMarkup(React.createElement(React.Fragment,null,button.children)).includes('Synthetic event')||renderToStaticMarkup(React.createElement(React.Fragment,null,button.children)).includes('Open ticket')))button.onPress()
 expect(state.push.mock.calls.filter(([path])=>path==='/ticket/registration-1')).toHaveLength(2)
 expect(state.push).not.toHaveBeenCalledWith('/ticket/cancelled-1')
})
it('opening the ticket retains its QR and both registered-event actions',()=>{
 state.params={id:'registration-1'}
 const html=render(Ticket);expect(html).toContain('Ticket QR');expect(html).toContain('Add to calendar');expect(html).toContain('data-registration="registration-1"');expect(html).toContain('data-event="event-1"')
})

it('ticket shows server attendance and retains it on reopening; unchecked ticket never claims success',()=>{
 state.params={id:'registration-1'};state.data.checked_in_at='2026-10-05T15:20:00Z'
 expect(render(Ticket)).toContain('Checked in ');expect(render(Ticket)).not.toContain('Not checked in')
 expect(render(Ticket)).toContain('Checked in ')
 state.data.checked_in_at=null;expect(render(Ticket)).toContain('Not checked in')
 state.error='Check-in is outside the event window';expect(render(Ticket)).not.toContain('Checked in ')
})

it('My Events separates saved attendance from confirmed booking status and does not offer cancellation after check-in',()=>{
 state.data=[{id:'registration-1',event_id:'event-1',status:'confirmed',checked_in_at:'2026-10-05T15:14:48Z',event:{title:'Volunteer Check-in',event_date:'2030-01-01'},ticket_type:{name:'Free admission',price:0}}]
 const html=render(MyEvents);expect(html).toContain('confirmed');expect(html).toContain('Checked in');expect(html).toContain('Open ticket');expect(html).not.toContain('Cancel free registration')
 state.data[0].checked_in_at=null;expect(render(MyEvents)).toContain('Not checked in')
 delete state.data[0].checked_in_at;expect(render(MyEvents)).not.toContain('Not checked in')
})
it('authorized roster displays names and checked-in time or not-checked-in without exposing contacts',()=>{
 state.data={confirmed:2,checked_in:1,attendees:[{registration_id:'a',full_name:'Alex',status:'confirmed',checked_in_at:'2026-10-05T15:14:48Z'},{registration_id:'b',full_name:'Sam',status:'confirmed',checked_in_at:null}]}
 const view=()=>renderToStaticMarkup(React.createElement(Roster,{eventId:'event-1'}));const html=view();expect(html).toContain('Alex');expect(html).toContain('Sam');expect(html).toContain('1 checked in / 2 confirmed');expect(html).toContain('Checked in');expect(html).toContain('Not checked in')
 state.error='Attendance report not permitted';expect(view()).toContain('Attendance report not permitted');expect(view()).not.toContain('Alex')
})
