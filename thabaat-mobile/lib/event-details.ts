export type EventDetails = { image_url?: string | null; age_min?: string | null; age_max?: string | null; audience_gender?: string; address?: string; speaker_name?: string | null; speaker_bio?: string; logistics?: string; eligibility?: string; faqs?: string; timezone?: string | null; end_at?: string | null; members_only?: boolean }
export const emptyEventDetails = { image_url: '', age_min: '', age_max: '', audience_gender: '', address: '', speaker_name: '', speaker_bio: '', logistics: '', eligibility: '', faqs: '', timezone: '', end_at: '', members_only: false }
export function validateEventDetails(details: EventDetails, start: string) {
 for (const field of ['image_url','audience_gender','address','speaker_name','speaker_bio','logistics','eligibility','faqs'] as const) if ((details[field]?.length || 0)>5000) throw new Error('Event detail exceeds 5000 characters.')
 if (details.image_url && !/^https:\/\//i.test(details.image_url)) throw new Error('Event images must use a public HTTPS URL.')
 for(const field of ['age_min','age_max'] as const) if(details[field] && (!/^\d{1,3}$/.test(details[field]!) || Number(details[field])>120)) throw new Error('Age limits must be whole numbers from 0 to 120.')
 if(details.age_min && details.age_max && Number(details.age_max)<Number(details.age_min)) throw new Error('Maximum age must be at least minimum age.')
 try { if(details.timezone) new Intl.DateTimeFormat('en-US', {timeZone: details.timezone}) } catch { throw new Error('Choose a valid IANA timezone, such as America/Detroit.') }
 if (details.end_at && (!Number.isFinite(Date.parse(details.end_at)) || Date.parse(details.end_at)<=Date.parse(start))) throw new Error('End time must be after start time.')
 return {...details,end_at:details.end_at ? new Date(details.end_at).toISOString():null}
}
