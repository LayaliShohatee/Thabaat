// Thabaat design tokens · Brand Refresh 2026 ("Olive Grove").
// Source: the client's "Thabaat Brand Refresh" Drive folder (official logo adopted October 5, 2026; see docs/BRAND.md).
// Three rules that shape every value here:
//   1. Letters and text are forest or cream. Only the logo's three marks are teal.
//   2. Teal is never a surface: it appears at the point (an active icon, a small accent), never as a background.
//   3. Fraunces for headlines, Instrument Sans for body and labels (labels: 600, uppercase, tracked). No other typefaces.
export const brand = {
 // grounds and ink
 primary: '#1E3328', // forest 700 · buttons and primary actions (cream text on it)
 primaryDark: '#14231B', // forest 800 · pressed state, deep grounds
 primarySoft: '#EEF2EF', // forest 50 · soft chips and selected rows
 forest: '#1E3328', // forest 700 · hero and header grounds
 forestDeep: '#0B150F', // forest 900 · night grounds
 forestSoft: '#E6DFCC', // sand 200 · secondary text on forest grounds
 ink: '#1E3328', // forest 700 · all text
 inkMuted: '#5B5342', // sand 700 · secondary text on cream (6.5:1)
 page: '#F2EEE3', // cream · the page ("warm, never white")
 card: '#FBF9F5', // sand 50 · cards
 line: '#E6DFCC', // sand 200 · hairlines and borders
 sage: '#A7B59B', // rules, captions, quiet surfaces
 // the mark
 teal: '#00A7A7', // teal 500 · marks and small accents only, never a background
 tealText: '#00716F', // teal 700 · teal for small type (tab labels, links)
 // accents
 zayt: '#D9B964', // zayt 300 · olive-oil gold (was gold)
 zaytSoft: '#FAF5E6', // zayt 50
 zaytDeep: '#735720', // zayt 700 · warning text on zaytSoft
 olive: '#6F7F3C', // olive 500 · success and confirmed states
 oliveSoft: '#F4F5EA', // olive 50
 clay: '#B45F35', // clay 500
 danger: '#954B28', // clay 600 · errors and destructive actions
 dangerSoft: '#FBF0EA', // clay 50
 // shape: the brand spaces in 12px steps (1n)
 radius: 12,
 radiusSmall: 8,
} as const
export const fonts = {
 heading: 'Fraunces_600SemiBold',
 headingHeavy: 'Fraunces_700Bold',
 label: 'InstrumentSans_600SemiBold',
 body: 'InstrumentSans_400Regular',
 bodyMedium: 'InstrumentSans_500Medium',
} as const
// Thabaat's public links. Replace instagram with the Linktree address once the client confirms it.
export const links = {
 social: 'https://www.instagram.com/thabaatmi/',
 website: 'https://www.thabaat.org/',
 email: 'contact@thabaat.org',
} as const
export const shadow = {
 shadowColor: '#1E3328',
 shadowOpacity: 0.08,
 shadowRadius: 14,
 shadowOffset: { width: 0, height: 6 },
 elevation: 3,
} as const
