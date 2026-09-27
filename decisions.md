# Decisions and rejected alternatives

| Decision | Chosen | Rejected (why) |
|---|---|---|
| Collection backend | Firebase Auth + Firestore + Hosting, client-side scoring | Static/no-backend (no shared leaderboard); Google Form (least polished); Cloud Functions (needs Blaze, unnecessary for 5 questions) |
| Identity | Google sign-in OR name (+optional phone) | Anonymous only (can't award prize to a person) |
| WhatsApp | Invite link button + CSV export | Auto-add via API (WhatsApp offers no free community-add API) |
| Season table | Dropped (R2) | Carry-over points (guests change every race) |
| Tiebreak | Earliest submission; host override | Random draw (opaque); sudden-death question (needs another live judged answer) |
| Theme | Dark + Baku red fallback; swappable tokens | Guessing Karter Cup colours (couldn't verify; Instagram not scrapeable) |
| Search result "Kartar Cup" | Ignored Indonesian Karang Taruna tournaments | Using them as brand reference (wrong org) |
| Build priority (2026-09-27) | 1) Home page (H1, in flight): community/brand page, quiz demoted. 2) `/events` page: full upcoming-events listing. 3) Booking page: buyer flow off `/events`, using the existing B1 data/rules layer. Host scanner, big-screen podium, calendar validation, guest history/stats all come after | User: "priority, home page, then events page which takes to booking page" | Home page's own Upcoming Events section stays a short teaser linking to `/events`, not a full listing built twice |

## Deferred / future scope
- Android app for community members only (user, 2026-09-27): discuss and scope later, not started.

## PRD (2026-09-27, two docs added by user)
Decision: Vision doc, not a rewrite. Keep the current Vite+React+Firebase serverless build and all 28 rules/decisions made today. Adopt two PRD ideas now: OpenF1 as the live-data source (not FastF1 - FastF1 has no live capability, confirmed by earlier research; OpenF1 does), and Tier-1 manual-UPI-with-UTR-verification as the real next step beyond R23's mock-pay (not built this session). Rejected for now: Next.js/Cloud Functions replatform, 1/3-distance dynamic lock (keep R13's time-based lock), Electric Emerald/Midnight Void/Inter palette (keep R26/R27's real-brand-derived palette), multi-role system (keep R10/R18's single-host model).

## Session-end demo priority (2026-09-27, ~19:18 IST)
User needs a deployed, demo-safe production build by end of this session to pitch the company for a deal. Cut for this session: booking QR/scanner/payment, big-screen podium, calendar validation script, guest history/stats, Android app. In scope: verify build, deploy to production kartar-cup, add host doc, set a live active event.

## Local dev server target (2026-09-27)
`npm run dev` (plain `vite`, no mode flag) now connects to the REAL kartar-cup Firebase project via `.env.local` (gitignored, mirrors `.env.production.local`), not the emulator. Background agents continue verifying against the emulator (explicit VITE_USE_EMULATORS=true) so their throwaway test data never lands in the production database being demoed. `localhost` is already an authorized domain on kartar-cup, so Google sign-in works from the local server unmodified.
