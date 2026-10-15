# Thabaat app: design audit

**App:** React Native + Expo SDK 57 (expo-router, Reanimated 4.5, Gesture Handler, expo-haptics). It runs on iPhone and also builds for web.
**Branch:** `design-polish`. Only design, motion and polish change here, never app logic, data or features.
**Skills used:**
- **find-animation-opportunities** (FAO), **improve-animations** (IA), **emil-design-eng** (EDE), **apple-design** (AD): the audit.
- **animate-expo** (AE): for implementation.
- **mobile-native** was not used, because it only applies to web apps.

**Shared motion values (from AE/EDE):**
- **Ease-out curve:** `cubic-bezier(0.23, 1, 0.32, 1)`.
- **Default spring:** `{ duration: 400, dampingRatio: 1 }`.
- **Momentum spring:** `dampingRatio: 0.8`.
- **Reduced motion:** gentler, not zero. Opacity fades stay; scale and translate are dropped.

## Prioritized findings

| # | Impact | Status | File(s) | Problem | Fix (exact values) | Source |
|---|---|---|---|---|---|---|
| 1 | High | ✅ Done (`4636df1`) | `components/PressableScale.tsx`, `ManagementUI.tsx`, tab screens, `EventCard.tsx` | `TouchableOpacity` flashes to 20% opacity on press, which reads as a flicker. | Scale 0.97 on press-in, 120ms ease-out, as a Reanimated CSS transition (runs on the UI thread). `pressRetentionOffset` 12. Reduced motion: opacity 0.85 instead of scale. | EDE, AD §1, AE §7 |
| 2 | High | ✅ Done (`5696b13`) | `app/event/[id].tsx`, `CalendarActions.tsx`, `EventShareActions.tsx` | Register is buried under 4 full-width buttons, and some text is white on a light background. | Register pinned to the bottom (52pt pill). Registered state: "You're registered · Open ticket". Calendar, Share and Waitlist become pills that open panels. Date in Detroit time. | EDE, AD §16 Simplicity |
| 3 | High | ✅ Done (`cae3e2f`) | `app/ticket/[id].tsx` | Title shown twice; time with seconds in the device time zone; the private code is dominant. | One "Your ticket" title, Detroit time, status pill, 240pt QR code, private code behind "Show private code". | EDE, AD §16 |
| 4 | High | ✅ Done (`4d1bf63`) | `app/_layout.tsx`, tab and auth screens | The status bar is forced to `light` (white) for the whole app, so on light screens (Events, Team, Admin, Account, Login) the clock and battery are invisible on iPhone. | New `useStatusBarStyle('dark')` hook: on focus it calls `setStatusBarStyle('dark')`, and on blur it returns to `'light'` for the navy-header stack screens. Home keeps `light` (navy hero). | AD §16 Craft, §12 legibility |
| 5 | High | ✅ Done (`0a243cc`) | `app/registration/[eventId].tsx`, `app/registration/confirmation.tsx` | The attendee registration path still uses the old look: system bold, 8pt corners, opacity flash, and a "Register for Event" title that repeats the header. | Selectable ticket cards (primary border plus check when selected), Montserrat headings, a 52pt pill confirm button, Cancel as a quiet link, everything through `PressableScale`. | EDE, AD §16 Familiarity/Craft |
| 6 | Medium | ✅ Done (`ff65398`) | `app/_layout.tsx`, `app.json` | The navigation theme switches to `DarkTheme` when the phone is in dark mode, but every screen is drawn light. Dark backgrounds flash between screens during transitions, and native UI (keyboard, alerts) turns dark. | Always use a brand light theme (`background: brand.page`, `card: brand.card`, `primary: brand.primary`), and set `"userInterfaceStyle": "light"`. A proper dark palette is future work. | AD §16 Craft, §14 (no abrupt brightness jumps) |
| 7 | Medium | ✅ Done (`26fe111`, native only: react-native-web ignores `hitSlop` on Pressable, so verify on iPhone by tapping just outside a chip) | `ManagementUI.tsx` (chip, link), event page pills, `DateTimeField.tsx` | Touch targets are under 44pt: chips are about 34pt, links about 30pt, calendar days 36pt. | `hitSlop` so every target reaches at least 44×44pt: chips and pills `{top:6,bottom:6}`, links 10, day cells 4, time chips 6. The visuals stay the same. | AE §7, AD §10 |
| 8 | Medium | ✅ Done (`bf2c1e4`) | `components/events/MyTickets.tsx`, `WaitlistScreen.tsx`, auth screens, `profile/edit.tsx`, `SuggestedDonation.tsx` | These screens still flash on press and use system-bold headings. | Swap to `PressableScale`; headings in Montserrat (`fonts.heading`); buttons as fully rounded pills. | EDE, AD §16 Craft |
| 9 | Medium | ✅ Done (`8bbcd74`, rotation checked in the browser; fade timing needs a device check because the preview pane throttles animation frames) | `app/faq.tsx`, `DateTimeField.tsx`, `team.tsx`, event page panels, ticket private code | Expanding sections pop in instantly. | Reanimated `entering={FadeIn.duration(180).easing(EASE_OUT)}`, `exiting={FadeOut.duration(120)}`. Opacity only, so it's also the reduced-motion version (nothing moves). The FAQ "+" turns 45° on a 180ms ease-out transition (dropped under reduced motion). | FAO, EDE, AE §3 |
| 10 | Medium | ✅ Done (`032027f`, web preview rises 25pt instead of 8pt: Reanimated's web build stalled on custom start values, so the content stayed hidden. Phones use 8pt. Spring and haptic need a device check.) | `app/registration/confirmation.tsx` | The "You're registered" moment is flat. It's rare (once per booking), so it's the place for a little delight. | ✓ circle: scale 0.9→1 plus opacity 0→1 with a spring `{ duration: 400, dampingRatio: 0.7 }`. Success haptic in the same frame. Title and actions fade up 8pt over 240ms ease-out, with a 50ms stagger. Reduced motion: 200ms opacity fade only; the haptic stays. | FAO (delight tier), AD §13, AE §8 |
| 11 | Low | ✅ Done (`c2e9232`, haptics are native only; the switches still work in the browser) | `PressableScale.tsx`; Events, Team and Manage switches; `DateTimeField.tsx` | Changing a segment or a picker value gives no "tick". | `haptic="selection"` prop calls `Haptics.selectionAsync()` on press, iOS only, one per tap, always alongside the visual change. | AE §8, AD §13 Utility |
| 12 | Low | ✅ Done (`8b0f4e1`) | `ManagementUI.tsx`, `index.tsx`, `event/[id].tsx`, `ticket/[id].tsx`, auth screens | Large Montserrat headings (22–30pt) use the same tracking (letter-spacing) as body text and look loose. | `letterSpacing: -0.4` on headings 22pt and up, `-0.2` on 17–20pt, body at 0. Small uppercase labels keep +1 to +1.5. | AD §15 |
| 13 | Low | ✅ Done (`a427335`) | `components/Skeleton.tsx`; Home, Events and Event page loading states | A lone spinner in the middle of a blank screen. | 2 placeholder cards shaped like the event cards; opacity pulses 1 → 0.6 → 1 every 900ms (linear, Reanimated CSS animation). Reduced motion: static at 0.8 opacity. | EDE (perceived performance), IA |
| 14 | Low | ✅ Done (`7d48393`) | `app/(tabs)/index.tsx` | The "Your next event" card overlaps the navy hero with a hard edge. | Hero `paddingBottom` 56 → 60; card `shadowOpacity` 0.06, `shadowRadius` 18. | EDE |
| 15 | Low | ✅ Done (`c7e9e4c`) | `components/parallax-scroll-view.tsx`, `hello-wave.tsx`, `ui/collapsible.tsx`, `external-link.tsx`, `assets/images/*react-logo*` | Unused Expo starter files, including old motion code. | Delete them. `app/modal.tsx` and the themed components stay, because a route counts as an app feature. | IA (cohesion) |
| 16 | Low | ⏭️ Skipped | Native stack header | Apple uses translucent blurred bars with content scrolling underneath. | **Skipped:** `headerTransparent` plus a blur would change the layout of every stacked screen (content would need header-height insets), and blur legibility can't be checked in the web preview. That's too risky without device testing. Revisit on a real iPhone. | AD §12 |

## Considered and rejected (on purpose)
- **Tab switch animation:** tabs are side by side and used dozens of times a session, so they stay instant (AE §1).
- **Staggered fade-in for the Home and Events lists:** seen many times a day, so it would feel slow (FAO gate: frequency).
- **Parallax on the Home hero:** decorative, on a screen seen constantly (FAO gate: purpose).
- **Animating the QR code or check-in results:** volunteers read them at speed at the door, so motion gets in the way (FAO gate: function).
- **Month-change animation in the date picker:** tapped repeatedly while filling in a form (FAO gate: frequency).

## How to check on a device
Springs, haptics and the status bar can't be judged in the web preview. On an iPhone release build, check that:
1. The status bar is readable on every tab.
2. The press scale feels immediate.
3. The confirmation ✓ spring and haptic land together.
4. With Settings → Accessibility → Motion → Reduce Motion on, nothing slides or scales.
