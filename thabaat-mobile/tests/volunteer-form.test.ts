import { describe, expect, it } from 'vitest'
import { emptyVolunteerInterest, toggle, volunteerAnswers, volunteerProblem } from '../lib/volunteer-form'

const complete = emptyVolunteerInterest({
  email: 'v@example.invalid', name: 'Volunteer', age: '27', gender: 'female', phone: '555-0100', city_state: 'Detroit, MI', profession: 'Teacher',
  experience: 'Food bank', why_join: 'To help', hours_per_month: ['3-5 Hours'], attendance_frequency: '1-3 sessions/events',
  available_days: ['Friday'], contribute_as: ['Program Anchor'], anchor_programs: ['Not Applicable'],
})

describe('volunteer interest form', () => {
  it('accepts a complete form and requires every starred question', () => {
    expect(volunteerProblem(complete)).toBeNull()
    expect(volunteerProblem({ ...complete, phone: ' ' })).toMatch(/Phone/)
    expect(volunteerProblem({ ...complete, available_days: [] })).toMatch(/days/)
    expect(volunteerProblem({ ...complete, anchor_programs: [] })).toMatch(/Not Applicable/)
  })
  it('enforces the 23+ rule', () => {
    expect(volunteerProblem({ ...complete, age: '22' })).toMatch(/23 or older/)
  })
  it('sends typed "Other" attendance and toggles checkbox answers', () => {
    expect(volunteerProblem({ ...complete, attendance_frequency: 'Other' })).toMatch(/attended/)
    expect(volunteerAnswers({ ...complete, attendance_frequency: 'Other', attendance_other: 'Twice' }).attendance_frequency).toBe('Other: Twice')
    expect(volunteerAnswers(complete)).not.toHaveProperty('attendance_other')
    expect(toggle(toggle(['Monday'], 'Friday'), 'Monday')).toEqual(['Friday'])
  })
})
