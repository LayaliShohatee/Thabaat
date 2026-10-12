export type GenderFilter='all'|'female'|'male'|'unspecified'
export type AgeFilter='all'|'under18'|'18-29'|'30-49'|'50plus'|'unknown'
export const GENDER_FILTERS:[GenderFilter,string][]=[['all','All genders'],['female','Female'],['male','Male'],['unspecified','Not shared']]
export const AGE_FILTERS:[AgeFilter,string][]=[['all','All ages'],['under18','Under 18'],['18-29','18–29'],['30-49','30–49'],['50plus','50+'],['unknown','Age not shared']]
type Demographic={gender?:string|null;age?:number|null}
export function matchesGender(a:Demographic,f:GenderFilter){return f==='all'||(f==='unspecified'?!a.gender||a.gender==='prefer_not_to_say':a.gender===f)}
export function matchesAge(a:Demographic,f:AgeFilter){
 if(f==='all')return true
 if(a.age==null)return f==='unknown'
 return f==='under18'?a.age<18:f==='18-29'?a.age>=18&&a.age<=29:f==='30-49'?a.age>=30&&a.age<=49:f==='50plus'?a.age>=50:false
}
export function filterAttendees<T extends Demographic>(list:T[],gender:GenderFilter,age:AgeFilter){return list.filter(a=>matchesGender(a,gender)&&matchesAge(a,age))}
export function genderLabel(g?:string|null){return g==='female'?'Female':g==='male'?'Male':'Gender not shared'}
