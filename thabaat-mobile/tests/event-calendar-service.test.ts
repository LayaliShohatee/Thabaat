import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openDeviceCalendar } from '../services/eventCalendarService'
const mocks = vi.hoisted(() => ({ permissions: vi.fn(), calendars: vi.fn(), defaultCalendar: vi.fn(), form: vi.fn() }))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('expo-calendar', () => ({ requestCalendarPermissions: mocks.permissions, getCalendars: mocks.calendars, getDefaultCalendarSync: mocks.defaultCalendar, EntityTypes: { EVENT: 'event' } }))
const event = { id: 'one', title: 'Community', description: null, event_date: '2026-11-01T18:00:00Z', location: 'Venue' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions.mockResolvedValue({ granted: true })
  mocks.calendars.mockResolvedValue([{ allowsModifications: false }, { allowsModifications: true, addEventWithForm: mocks.form }])
  mocks.defaultCalendar.mockReturnValue({ addEventWithForm: mocks.form })
  mocks.form.mockResolvedValue({ action: 'saved' })
})
describe('device calendar boundary', () => {
  it('requests write-only iOS access and waits for confirmed save', async () => {
    expect(await openDeviceCalendar(event)).toContain('saved')
    expect(mocks.permissions).toHaveBeenCalledWith(true)
    expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({ title: event.title, startNewActivityTask: false }))
  })
  it('allows a cancelled editor to reopen without claiming a save', async () => {
    mocks.form.mockResolvedValueOnce({ action: 'canceled' })
    expect(await openDeviceCalendar(event)).toContain('No event was added')
    expect(await openDeviceCalendar(event)).toContain('saved')
    expect(mocks.form).toHaveBeenCalledTimes(2)
  })
  it('never reads calendars or opens a form after permission denial', async () => {
    mocks.permissions.mockResolvedValue({ granted: false })
    await expect(openDeviceCalendar(event)).rejects.toThrow('permission')
    expect(mocks.calendars).not.toHaveBeenCalled()
    expect(mocks.form).not.toHaveBeenCalled()
  })
  it('recovers from absent writable calendar and form errors', async () => {
    mocks.defaultCalendar.mockReturnValueOnce(null)
    await expect(openDeviceCalendar(event)).rejects.toThrow('No writable calendar')
    mocks.form.mockRejectedValueOnce(new Error('Editor unavailable'))
    await expect(openDeviceCalendar(event)).rejects.toThrow('Editor unavailable')
    expect(await openDeviceCalendar(event)).toContain('saved')
  })
})
