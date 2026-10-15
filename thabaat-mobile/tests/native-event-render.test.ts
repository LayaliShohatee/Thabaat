import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({data:null as any,error:'',loading:false}))
vi.mock('../hooks/useStatusBarStyle',()=>({useStatusBarStyle:()=>{}}))
vi.mock('react-native',async()=>{const R=await import('react');const box=({children}:any)=>{const inspect=(value:any):void=>{R.Children.forEach(value,child=>{if(typeof child==='string'||typeof child==='number')throw new Error('Raw text outside native Text');if(R.isValidElement(child)&&child.type===R.Fragment)inspect((child.props as any).children)})};inspect(children);return R.createElement('div',null,children)};return {View:box,ScrollView:box,Text:({children}:any)=>R.createElement('span',null,children),TouchableOpacity:box,TextInput:()=>null,Switch:()=>null}})
vi.mock('expo-router',()=>({router:{push:vi.fn()}}))
vi.mock('../hooks/useFocusResource',()=>({useFocusResource:()=>({...state,reload:vi.fn()})}))
vi.mock('../services/managementService',()=>({getEventAttendees:vi.fn(),getPermissions:vi.fn(),getManagementEvents:vi.fn(),saveEvent:vi.fn(),archiveEvent:vi.fn()}))
vi.mock('../components/FreeTicketInventory',()=>({FreeTicketInventory:()=>null}))
vi.mock('../components/EventVolunteers',()=>({VolunteerRoleFields:()=>null,EventVolunteers:()=>null}))
vi.mock('../services/volunteerCheckinService',()=>({makeRegistrantVolunteer:vi.fn()}))
vi.mock('../services/eventImageService',()=>({uploadEventFlyer:vi.fn()}))
vi.mock('../components/EventRefundsAndCodes',()=>({EventRefundsAndCodes:()=>null}))
vi.mock('../components/PublicEventPublisher',()=>({PublicEventPublisher:()=>null}))
vi.mock('../components/PressableScale',async()=>{const R=await import('react');return {PressableScale:({children}:any)=>R.createElement('div',null,children)}})
vi.mock('../components/ManagementUI',()=>({ManagementButton:()=>null,ManagementChip:()=>null,ManagementLink:()=>null,managementStyles:{}}))
import {EventAttendees} from '../components/EventAttendees'
import AdminTab from '../app/(tabs)/admin'
it('native attendee loading and no-result states render without stray text',()=>{for(const data of [null,{counts:{total:0,confirmed:0,pending:0,cancelled:0},capacity:20,reserved:0,attendees:[]}]){state.data=data;state.loading=false;state.error='';expect(()=>renderToStaticMarkup(React.createElement(EventAttendees,{eventId:'fixture'}))).not.toThrow()}})
it('native attendee success and error recovery render a valid Text tree',()=>{state.data={counts:{total:1,confirmed:1,pending:0,cancelled:0},capacity:20,reserved:0,attendees:[{registration_id:'fixture',full_name:'Synthetic attendee',ticket_name:'Free',status:'confirmed',registered_at:'2030-01-01'}]};state.error='';expect(renderToStaticMarkup(React.createElement(EventAttendees,{eventId:'fixture'}))).toContain('Synthetic attendee');state.error='Retry permitted';expect(renderToStaticMarkup(React.createElement(EventAttendees,{eventId:'fixture'}))).toContain('Retry permitted')})

it('native staff event list renders without stray text between controls',()=>{state.data={events:[{id:'fixture',title:'Synthetic event',event_date:'2030-01-01',location:'Synthetic venue',capacity:20,created_by:'staff'}],permissions:{user_id:'staff',staff_role:'admin',can_manage_events:true},setupError:''};state.error='';state.loading=false;expect(()=>renderToStaticMarkup(React.createElement(AdminTab))).not.toThrow()})
