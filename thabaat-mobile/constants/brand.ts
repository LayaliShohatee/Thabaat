// Thabaat design tokens, matched to thabaat.org: teal and deep navy with a warm gold accent, Montserrat headings.
// primary is a deepened version of the site's teal (#129997) so white text on it stays readable (WCAG AA).
export const brand = {
 primary: '#0E7C7A',
 primaryDark: '#0A5F5D',
 primarySoft: '#E3F3F2',
 teal: '#129997',
 navy: '#182931',
 navySoft: '#A8BEC7',
 gold: '#FFBD3E',
 goldSoft: '#FFF4DC',
 ink: '#182931',
 inkMuted: '#55666E',
 line: '#DDE5E7',
 page: '#F4F7F7',
 card: '#FFFFFF',
 danger: '#B3261E',
 dangerSoft: '#FDECEA',
 radius: 16,
 radiusSmall: 12,
} as const
export const fonts = {
 heading: 'Montserrat_700Bold',
 headingHeavy: 'Montserrat_800ExtraBold',
 label: 'Montserrat_600SemiBold',
} as const
// Thabaat's public links. Replace instagram with the Linktree address once the client confirms it.
export const links = {
 social: 'https://www.instagram.com/thabaatmi/',
 website: 'https://www.thabaat.org/',
 email: 'contact@thabaat.org',
} as const
export const shadow = {
 shadowColor: '#182931',
 shadowOpacity: 0.08,
 shadowRadius: 14,
 shadowOffset: { width: 0, height: 6 },
 elevation: 3,
} as const
