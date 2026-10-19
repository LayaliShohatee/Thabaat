# Brand

The app follows **Thabaat Brand Refresh 2026 ("Olive Grove")**. The master files live in the client's Drive folder *Thabaat Brand Refresh* (`Thabaat-Brand-Guide-2026.pdf`, `Thabaat-Brand-Refresh-Summary.pdf`, `Brand-Assets/`, `Thabaat-Logo-Official-2026/`). Only the **official logo set** (`Thabaat-Logo-Official-2026/`, adopted October 5, 2026) is used here; the folders marked "beta · retired Oct 5, 2026" must never be used for new work.

## Where it lives in the code

| What | Where |
|---|---|
| Colour, type and radius tokens | `thabaat-mobile/constants/brand.ts` (`brand`, `fonts`) |
| Logo component | `thabaat-mobile/components/BrandLogo.tsx` (`variant` lockup/icon, `ink` full-colour/reverse) |
| Logo masters (SVG) and in-app PNG renders | `thabaat-mobile/assets/brand/` |
| App icon, splash, Android adaptive icon, favicon | `thabaat-mobile/assets/images/`, colours in `app.json` |
| Apple Wallet pass icon and colours | `thabaat-backend/src/wallet/assets/`, `src/wallet/pass.ts` |
| Fonts | `@expo-google-fonts/fraunces`, `@expo-google-fonts/instrument-sans` (SIL Open Font License), loaded in `app/_layout.tsx` |

## The rules that matter

1. Letters and text are **forest** `#1E3328` or **cream** `#F2EEE3`. Only the logo's three marks are teal.
2. **Teal `#00A7A7` is never a surface.** It appears at the point: the active tab, a small accent, the marks. Teal text uses Teal 700 `#00716F`.
3. **Fraunces** for headlines (`fonts.heading`, `fonts.headingHeavy`), **Instrument Sans** for body and labels (`fonts.body`, `fonts.label`: 600, uppercase, tracked). No other typefaces.
4. Never retype "thabaat" in any font, never stretch, outline, shadow or recolour the logo. Keep 24 px of clear space around it. Use the full-colour ink on cream and the reverse ink on forest or dark grounds.
5. Accents: Zayt (gold) `#D9B964` for highlights, Olive `#6F7F3C` for success, Clay `#954B28` for errors. Space in 12 px steps.

## Colour balance in the app

Gold and forest together read as harsh on a phone, so the app uses one dark ground per screen (the Home hero in forest 800 `brand.hero`, headers and selected pills in forest 700) on the cream page, and keeps gold (`brand.zayt`) for warning text on a pale tint only. Quiet accents (the date badge, the "next event" bar, pending-request cards, the profile avatar) use sage or the pale forest tint, never a gold surface. Teal stays at the point: the active tab and the marks.

## Event flyers

Flyers are uploaded from Admin › event › Edit › "Upload flyer" (JPEG, PNG or WebP up to 5 MB) into the public `thabaat-event-images` bucket. Make them from the brand's flyer templates (1080 × 1350, Fraunces headlines, Instrument Sans details, the programme's own ground: Qiyams on deep forest with the zayt glow, Mondays on the teal 900 panel over cream, Pop-Ups on clay). The upload policy keeps the admin/organizer and path checks; the bucket enforces type and size (`database/migrations/20261015120000_event_flyer_upload_policy.sql`).

## Regenerating assets

The PNGs were rendered from the official SVGs (icon centred on forest for the app icon, transparent for the splash and the Android foreground, inside the 66 % safe zone). Icon, splash and adaptive-icon changes only reach a device after a native rebuild (`npx expo prebuild` or an EAS/dev-client build); Expo web and Metro pick up the in-app logo and colours immediately.

## Not yet done

Body text still uses the system font on screens that never set `fontFamily`; a pass applying `fonts.body` everywhere is a follow-up.
