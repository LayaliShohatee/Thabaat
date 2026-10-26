import { Linking } from 'react-native'

// The client's "Thabaat Volunteer Interest Form". Volunteers apply there so responses (and resumes) reach the team's Google account.
export const VOLUNTEER_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScZ9BoyUet4W9UqD7qg36Pny529ts1HjqTwIW63Q79QUBLJ1g/viewform'

// Opens in the phone's browser, where people are usually already signed in to Google (the form requires it).
export const openVolunteerForm = () => Linking.openURL(VOLUNTEER_FORM_URL)
