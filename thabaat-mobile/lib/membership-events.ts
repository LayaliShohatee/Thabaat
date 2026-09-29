import { membershipIsActive, type Membership } from './billing'

export const practiceEvents = [
 { id: 'community', name: 'Community Welcome', membersOnly: false },
 { id: 'study', name: 'Members Study Circle', membersOnly: true },
 { id: 'workshop', name: 'Members Workshop', membersOnly: true },
] as const
export type PracticeRegistration = { eventId: string; registeredAt: number }

// Practice-only gate. Real registrations must enforce membership in the database.
export function registerPracticeEvent(eventId: string, membership: Membership | null, registrations: PracticeRegistration[], now: number) {
 const event = practiceEvents.find(item => item.id === eventId)
 if (!event) return { registrations, message: 'Practice event not found.', accepted: false }
 if (event.membersOnly && !membershipIsActive(membership, now)) return { registrations, message: `${event.name}: registration blocked. An active, verified membership is required.`, accepted: false }
 if (registrations.some(item => item.eventId === eventId)) return { registrations, message: `${event.name}: already registered in practice.`, accepted: true }
 return { registrations: [...registrations, { eventId, registeredAt: now }], message: `${event.name}: practice registration confirmed. No real ticket was issued.`, accepted: true }
}
