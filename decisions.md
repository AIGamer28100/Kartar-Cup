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
| Quiz ownership (2026-10-08) | The quiz belongs to the BOOKING EVENT that runs it: quiz setup is a tab inside each watch party (`/host/bookings/:eventId/quiz`), not a global Settings screen. `bookingEvents/{id}.quizEventId` names its quiz; the live quiz is derived from the hosted event running now (R13 window), so `settings/active` is retired. Done during the Firestore wipe, so no migration was needed | (a) Keep quizzes keyed by race and only move the UI - rejected: two watch parties on the same race would still share one quiz, which is exactly the customisation the user asked for. (b) Collapse `events/` into the booking event entirely - rejected for now: scoring, entries, the big screen, profile history and firestore.rules all key off `events/{id}`, so the rewrite risk outweighed the saved indirection |

## Deferred / future scope
- Android app for community members only (user, 2026-09-27): discuss and scope later, not started.

## PRD (2026-09-27, two docs added by user)
Decision: Vision doc, not a rewrite. Keep the current Vite+React+Firebase serverless build and all 28 rules/decisions made today. Adopt two PRD ideas now: OpenF1 as the live-data source (not FastF1 - FastF1 has no live capability, confirmed by earlier research; OpenF1 does), and Tier-1 manual-UPI-with-UTR-verification as the real next step beyond R23's mock-pay (not built this session). Rejected for now: Next.js/Cloud Functions replatform, 1/3-distance dynamic lock (keep R13's time-based lock), Electric Emerald/Midnight Void/Inter palette (keep R26/R27's real-brand-derived palette), multi-role system (keep R10/R18's single-host model).

## Session-end demo priority (2026-09-27, ~19:18 IST)
User needs a deployed, demo-safe production build by end of this session to pitch the company for a deal. Cut for this session: booking QR/scanner/payment, big-screen podium, calendar validation script, guest history/stats, Android app. In scope: verify build, deploy to production kartar-cup, add host doc, set a live active event.

## Local dev server target (2026-09-27)
`npm run dev` (plain `vite`, no mode flag) now connects to the REAL kartar-cup Firebase project via `.env.local` (gitignored, mirrors `.env.production.local`), not the emulator. Background agents continue verifying against the emulator (explicit VITE_USE_EMULATORS=true) so their throwaway test data never lands in the production database being demoed. `localhost` is already an authorized domain on kartar-cup, so Google sign-in works from the local server unmodified.

## Always pass --project explicitly on firebase deploy (2026-09-30, incident)
A plain `firebase deploy --only hosting,firestore:rules` (no `--project` flag) deployed to the WRONG Firebase project (`recovery-companion-hack`, an unrelated prior project on the same machine), despite this repo's `.firebaserc` correctly defaulting to `kartar-cup`. Root cause: firebase-tools' `activeProjects` cache (`~/.config/configstore/firebase-tools.json`) had a stale entry mapping an ANCESTOR directory (`/home/hari`) to `recovery-companion-hack`, left over from an unrelated session, and the CLI's project resolution walked up to that cache hit before honoring the local `.firebaserc`. Hosting impact was contained (hit an unused default site, not the real `soter-recovery` site) and was cleared via `firebase hosting:disable --project recovery-companion-hack --site recovery-companion-hack`; Firestore rules impact (project-wide, so it DID hit the real database) was left for the user to restore via Firebase Console rules history, since no local backup of the original rules existed. Fix going forward: every `firebase` CLI command in this repo passes `--project kartar-cup` explicitly — never rely on `.firebaserc`/cache resolution alone.

## Race times come from the official schedule, not a flat 13:00 UTC (2026-10-02)
Every race was treated as starting 13:00 UTC (`DEFAULT_RACE_START_UTC_TIME`), so the home countdown and the /events watch-party times were hours off (Malaysia actually starts 07:00 UTC). Now `raceStartFor()` (src/lib/f1api.ts) uses the Jolpica schedule's real lights-out and only falls back to the flat default, flagged "(est.)", when the API has nothing for that round (e.g. 2027 not published). Jolpica was chosen over OpenF1 for this because it returns every session time for the whole season in one cached request, while OpenF1 rate-limits bursts (HTTP 429, seen when pulling results). Existing saved quiz events keep the time they were created with; only new ones use the real start. Rejected for now: a Three.js globe — its two blockers (circuit coordinates and session times) are now available from Jolpica, but it would still need a heavy 3D dependency and a world-geometry dataset, so it stays a future item.

## Guest/host code boundary (2026-10-01)
Guest-facing code (`src/guest/**`) must never import from `src/host/**`, even a trivial pure utility — `BookingCheckout.tsx` initially imported a date formatter from `src/host/settings/time.ts`, caught in review and replaced with a small local copy. Reason: `HostApp` is lazy-loaded specifically so guests never download host-console code (see `src/App.tsx`'s lazy imports and `HostApp.tsx`'s own comment); an import across that boundary is an architecture smell worth fixing even when the actual bundled cost is negligible (a one-function tree-shaken leaf), because it's the kind of thing that compounds into real bloat/coupling once copied a few more times. If a formatter/helper is genuinely shared, it belongs in `src/lib/` or a guest-side module, not borrowed from `src/host/`.

## Booking UI built with stub data ahead of real venue/pricing (2026-09-30/10-01, B2)
Per R35, built both the host admin UI (`src/host/bookings/`) and the guest checkout flow (`src/guest/BookingCheckout.tsx`, `src/lib/mapEmbed.ts`) before the user had real venue/ticket-price data, rather than waiting — this was an explicit user instruction, not a default. New booking events start with one placeholder tier at ₹0 (signals "not set" without fabricating a real-looking price, consistent with R26's no-fabrication rule) and zero discounts; the host fills in real data later through the same admin UI. Venue maps use a no-API-key `output=embed` Google Maps iframe trick (`toMapEmbedUrl()`), which only works for full `google.com/maps/...` URLs, not short `maps.app.goo.gl` links (falls back to a plain "Open in Google Maps" link for those) — a short-link resolution would need a server-side redirect follow, rejected as unnecessary complexity for this project's serverless/no-Cloud-Functions constraint (see the original PRD decision above).

## UPI / real payments: deferred, do not build now (2026-10-02)
User, after being offered options: "No hold on to the UPI, lets not have it now". Payments stay mock-pay (R23). Options already researched and NOT chosen: (1) manual UPI intent/QR + UTR entry + host verification queue (no gateway, no server; UTR is not proof of payment, host check is the control); (2) gateway (Razorpay / Cashfree / PhonePe PG) with signature-verified webhooks, run on a Cloudflare Worker (free tier) or Cloud Functions (Blaze plan). Rule if revived: the browser must never mark a booking paid; only a verified webhook or a host action may. Do not re-propose until the user raises it.

## Seat counter is tamper-resistant: release is tied to the cancelled booking (2026-10-02)
Review of b62585d: `capacityRelease` let ANY signed-in user lower an event's `bookedCount` by up to 10 (an event write cannot see a booking), so someone could free seats without owning a booking and then oversell via `capacityBump`; host cancel was also not tied to the decrease. Chosen (no Cloud Functions): the release write must set `bookingEvents/{id}.lastReleaseBookingId` to the booking being cancelled, and rules check it with get()/getAfter(): booking belongs to that event, was reserved/paid_mock and is cancelled in the same batch, caller owns it (or runs bookings), decrease equals its qty exactly, id differs from the previous release. The booking-cancel rule (guest AND host) binds back via getAfter on the event (decrease == qty and matching id), so neither write passes alone and one booking cannot release twice. Rejected: (1) deriving seats-left from a count of non-cancelled bookings - guests cannot list others' bookings (R15), so it would need a public counter doc anyway; (2) a separate counter doc - same write-path problem, more surface; (3) a similar booking-id tie on the reserve side - would publish a live ticket's id (== QR token) in a public event doc; a cancelled id is harmless. Residual: `capacityBump` is still not tied to a booking, so a signed-in user can waste seats up to capacity (DoS, never oversell); fixing it needs Cloud Functions or an unguessable reservation id distinct from the QR token.

## Push-notification reminders: not built (2026-10-02)
PRD s6 /account/notifications wants "lights out in 2h" style reminders. Not feasible serverless: sending FCM needs the Admin SDK / HTTP v1 with a service account (a server), and subscribing tokens to topics is also Admin-SDK-only; the client SDK cannot. Scheduled reminders also need a scheduler. What exists instead: Add to Calendar (Google + .ics) on tickets, the home countdown, and the mobile race-mode strip. Revisit together with the Cloudflare Worker / Cloud Functions option listed in the UPI decision above (same server would serve both), not before.

## Red Bull-inspired design: palette decision OPEN (2026-10-02)
R42 asked for Red Bull-inspired elements. Cloud research (docs/research/redbull-paddock.md, local) found the reference site is navy + red with sentence-case bold type, flat 1px-border cards, giant watermark numerals; no yellow in the UI chrome. Two ways to reconcile with R9 "one red accent": (A, recommended v1) one ACTION accent - red for buttons/links/focus, blue/gold/green only as semantic data tokens; (B) red + a scoped reward gold on points/badges/tier/leaderboard. NOT applied globally yet: waiting for the user's pick before any re-theme. Rejected: copying Red Bull fonts, logos, photos, names ("MyPaddock", "The Predictor"), black-on-red CTAs (fails contrast).

## VIP / Play cards: storage and scoring (2026-10-03, R45/R46)
Storage: Firebase Storage is NOT set up (no storage.rules; new buckets need the paid plan), Google Drive links are unreliable as image URLs (throttled/blocked), so each card design stores EITHER `imageUrl` (https CDN link, e.g. the owner's Cloudflare R2 public bucket with random file names - preferred) OR a compressed inline WebP data URL (<= ~400k chars) in `bookingEvents/{id}/cards/{cardId}`. A Cloudflare Worker for in-app uploads is possible later (same server idea as UPI/push, not built).
Privacy: the VIP design is readable by any signed-in guest (same for everyone); Play-card designs are host-only so the deck is not leaked (R15); at check-in the host copies the drawn card onto the guest's own booking (`playCard` snapshot + `passNumber`), so only the owner reads it.
Scoring: assumption (R46 not specified): Play-card points are a FLAT bonus added to the guest's total (`rankEntries(..., bonus)`), one card per booking, cancelled bookings ignored, matched to the quiz event by raceId. The conditional mode ("only if the card's driver finishes top N") is NOT built; add it if the owner wants it.
Rejected: Firebase Storage (needs paid plan), Drive hot-links, per-guest copies of the whole deck.

## Race detail page data and imagery (2026-10-03, R41)
Track layout: ONE precomputed OpenF1 qualifying/fastest lap per circuit (scripts/build-track-profiles.mjs -> src/config/tracks/profile/<circuitKey>.json, ~3 KB each, lazy-loaded) drawn as a single SVG: sector = line colour (+ S1/S2/S3 labels), elevation = line thickness, plus a profile strip sharing the sector colours and a lap slider (keyboard accessible). Sepang currently uses FP2 (no history): re-run `node scripts/build-track-profiles.mjs 12` after the 2026 Malaysia qualifying (session 11730) is over. Facts (length/laps/turns/first GP) are a static table in src/config/tracks/raceFacts.ts, cross-checked formula1.com vs Wikipedia; lap records omitted on purpose. Tyre nominations are a hand-maintained table (only Baku, Sepang, Singapore announced).
Live data: OpenF1 through one paced queue + cache; completed-session data only after the 30-minute free-data blackout; forecasts from Open-Meteo for sessions within 7 days. Attribution shown on the page (OpenF1 is CC BY-NC-SA 4.0 - NON-COMMERCIAL: needs the owner's legal sign-off if paid ticketing makes the club commercial; fallback is MIT geometry without elevation).
Driver faces: hot-linked from OpenF1's headshot_url (formula1.com media; no hotlink protection today; never downloaded/re-hosted), with a team-colour number badge fallback; flip SHOW_HEADSHOTS in RaceDetailPage.tsx to turn them off. Team logos: NOT used (trademark, no licence) - team colour bar + text name instead; official CDN logos only on the owner's explicit OK.
Routing: the race page lives at /races/:raceId because /events/:id is booking checkout.

## Palette decision RESOLVED (2026-10-03): Option B
Owner picked Palette B (see "Red Bull-inspired design: palette decision OPEN" above). Applied via tokens.css and the `text-accent` -> `text-accent-text` rename (red text on navy needs #FF4D61; the #D81E36 fill fails as small text). Gold is reserved for rewards (leaderboard/guest score numerals, earned badges + progress bars, Cup points). Audit still to do: make sure gold has not leaked onto buttons/links, and visual QA of every page on the new navy (e.g. hard-coded hsl() values in transitions/graphics.tsx and the brand gradient).
## Legal text and ownership (2026-10-03)
Terms/Privacy are a DRAFTING AID, not legal advice; operator fields in src/config/legal.ts are empty on purpose and render as marked placeholders. Repo LICENSE changed from MIT to proprietary. NOTE: earlier commits (and any public copy of the GitHub repo AIGamer28100/Kartar-Cup) were MIT-licensed; if the repo is public, make it private. A signed developer-operator agreement is the thing that actually protects the developer; the footer text does not.

## Keep OpenF1; talk to OpenF1 before production (2026-10-03)
Owner: keep using OpenF1 for now; negotiate / get written permission from OpenF1 once the design is finished and BEFORE taking the site to production. Until then: keep the race pages free and ad-free, keep the attribution on the page, label the committed track profiles (src/config/tracks/profile/*.json) as derived from OpenF1 data (CC BY-NC-SA 4.0). Fallback if refused: Wikipedia facts + MIT bacinger geometry + DEM elevation, drop session results/faces. The operator (not the developer) holds any permission obtained.

## Mock Lab functionality audit (2026-10-07)
Nobody had rendered `/race-state-mock` before this audit. Established by a permanent server-render test
(`src/dev/harness/smoke.test.ts`): all 13 panels and `MockLab` itself mount. Chosen over a browser test
because no jsdom or `@testing-library/react` is installed and adding one was out of scope; the cost is
that effects, clicks and layout are still unasserted anywhere. Rejected: adding jsdom (new dependency);
asserting rendered HTML content (brittle, and the panels are a dev tool, not a contract).

Fixed as part of the audit: `uninstallMockNet` only restored `globalThis.fetch` when it was still
`mockFetch`, so switching Mock Net off while a panel's own scoped shim sat on top of it cleared
`original` without restoring, losing the real fetch for the rest of the page's life. It now restores
unconditionally; a scoped shim's cleanup already guards on still being the active fetch. `clampStage`
returned NaN for a non-finite stage, which `ScreenApp` feeds straight from Firestore. A discount code
that matches nothing reached `applyDiscount` as `null`, indistinguishable from "no code typed", so a
wrong code produced no message at all; the lookup and the message now live in `guest/bookingModel`
(`findDiscountByCode`, `discountNotice`) where they are testable.

Confirmed but deliberately NOT by design questions, settled here so they are not re-litigated:
- `rankEntries`'s `override` promotes a guest only when they are tied on the top score. That is correct:
  the field is `tiebreakOverride` (see "Tiebreak" above), a tiebreak, not an arbitrary spotlight. R34's
  "spotlight each person" is the staged reveal (`screenState.stage` 0..3), a separate mechanism.
- `BookingCheckout` calling `applyDiscount` with no `nowMs` is correct in production - the default IS
  the real clock. Only the lab needs an injected clock, and the Booking panel passes its own.
- `entryStatusLabel`'s `/5` fallback is unreachable: `lib/db.listOwnEntries` sets `maxScore` in the same
  branch that sets `score`, so a scored row always carries its real max.

Left for the owner to decide (do not change without a ruling): client-side sold-out enforcement
(`isTierSoldOut` can never return true because `maxQtyFor` floors at 1), the missing at-capacity state
in `ClosedNotice`, `ticketQrPayload`'s fallback from `qrToken` to the booking id, and partial check-in
of a bundled booking (counted as 0 checked in, no 1/2 indicator, still cancellable). All four touch
capacity, ticket validity or what a guest is allowed to do.

## Events: the Previous race card (2026-10-09)

The Previous card beside Next on /events had a lot of dead space once the track layout and lights-out times were removed (the user: "too much white space"). Prototyped three layouts in Mock Lab (Previous card tab) against the real captured podium and picked one.

| Option | Verdict | Why |
|---|---|---|
| A. Winner tile (large portrait, name, team, race time) + P2/P3 rows | CHOSEN | Winner is the focus, fills the height, names fit down to 296px (the narrowest card, at a 1024px screen) |
| B. Podium trio (P2 / P1 / P3 on risers) | Rejected | Portraits too small, a gap above the risers, podium blocks clipped at the card bottom |
| C. Three equal ranked rows | Rejected | Reads evenly but no winner emphasis; truncated names at 296px ("Max Ver...") |
| Re-adding track layout / session times to fill the space | Rejected | User asked for them removed from a finished race |

Notes: result comes from lib/podium (OpenF1 session_result + drivers, never invented; shows "Results aren't available right now." when absent). Portraits are hot-linked, never re-hosted (R27 spirit, see Driver faces above). OpenF1's headshot_url is the 93px `1col` rendition, which is blurry on high-density screens, so the card rewrites `.transform/1col/` to `5col` (545px) for the winner and `2col` (206px) for the runners-up; the F1 CDN serves any width. The first attempt used `/transform/1col/` (leading slash) and silently matched nothing; PreviousRaceCard.test.ts now pins the exact URL shape.


## Race page: one weekend panel instead of three sections (2026-10-09)

The race detail page had "Sessions and weather" (a plain list), "Results and standings" (session tabs + table) and "Tyres". The user: the list is too simple, fold the per-session details into Classification, drop tyres, centre the podium with the rest of the classification below it as a list, and show driver head shots (not a circle with the driver code) on every podium.

- **Tyres removed** ("Tier stats" read as tyre stats: the compound nomination tiles and the used-in-race list). `fetchTyreUse` and `TYRES_2026` are now unused by the app and left in place.
- **Sessions list removed.** Each session tab in the results hub now opens with a `SessionInfo` card: status, local start-end time, weather as icon tiles (recorded for finished sessions, forecast within 7 days for upcoming ones, a one-line reason otherwise), and for race and sprint the winner and fastest lap. Every tab is selectable now, including upcoming ones (they show time and forecast, no table).
- **Podium** (race and sprint, Drivers view): the home page's `PodiumDisplay` (P2 | P1 | P3 on risers), centred, built from the classification (`podiumFromRows`: exactly P1-P3, all classified finishers, else none). The table below starts at P4. Teams view and practice/qualifying keep the full table. The separate podium section and its second OpenF1 fetch were dropped in favour of this (the hub already loads the results).
- **Head shots, not circles.** The podium face is now a team-coloured portrait tile (545px source for the winner, 319px for P2/P3; table avatars 206px) via `lib/portrait.ts`. The code monogram shows only if the image is missing. The Mock Lab podium used `headshotUrl: null`, which is why it only ever showed codes there; it now runs the real captured podium.
- Rejected: a separate podium section above the track (duplicated the Race tab's data and cost another API round trip), and keeping the sessions as cards beside the hub (two places for the same session).

Follow-up the same day: **two columns from xl (1280px)**. Left: the weekend (session tabs with the Drivers / Constructors switch to their right, the session card with time and weather, the centred podium, the classification from P4). Right: one track card (3D layout, then Circuit facts, Elevation and the S1/S2/S3 legend with each sector's length). The standalone fact tiles left the page; `TrackFacts` is shared by the card and by the no-layout fallback. Cards size their contents by the width of their own column (container queries), because a viewport breakpoint cannot know a column is narrow. Below xl the page is one column, classification first. "Teams" is now labelled "Constructors". Sector lengths are each sector's share of the telemetry lap's distance times the official length, so they are derived, not looked up; they are exact only as far as that lap's sampling is.

Follow-up: **layout depends on whether anything has results.** Before any session has finished (an upcoming weekend) there is nothing to classify, so the page stacks: the weekend's sessions first, the circuit below as one full-width card (3D view left, facts / elevation / sectors right once the card is wide). Once any session has results it switches to the two-column layout (xl+). Until the schedule loads, the race date decides, so a finished race does not jump from stacked to two columns. The hub opens on the session that matters: the race once it is done, otherwise the one running now, else the next to run (`openingSessionKey`, tested), else the latest finished one. Rejected: always two columns (the left one is just a notice and one card for an upcoming race, so the right column looked like the main content).

## Events: 2027 is cards, not a timeline (2026-10-09)

The user asked for the next-year calendar to look like the upcoming-event cards and for the list to be deleted (reverses R33). Deleted: `SeasonTimeline`, `timelineEntries` / `TimelineEntry` and their tests, the timeline loading skeleton. 2027 now renders the same featured Next card plus month groups as 2026. The Previous card is shown only when it belongs to the season on screen (or when only one season is left and there is no tab to switch to); without it, Next takes the full row. Rejected: keeping the timeline behind a toggle (the user said delete it).

## Refunds, tickets and door check-in (owner decisions, 2026-10-09)

- **A1 Refund cutoff stays absolute; only whole-event cancellation bypasses it.** Rejected: an *unpaid
  exception* as a new rule (not added; the pre-existing behaviour that a host+ may cancel an unpaid
  `reserved` booking inside the window, refund `none`, was kept as instructed and flagged for the owner);
  an *admin override* of the cutoff (rejected: the cutoff must mean the same for everyone). To stop the
  event-cancel exception being abused, cancelling an event now needs `canRefund()` (venue_host can no
  longer cancel an event) and cannot be created pre-cancelled or undone.
- **A2 Ticket QR is token-only.** Rejected: *keep the booking-id fallback* (an id is named on public
  counters, so an id QR is forgeable from public data). Legacy tickets get a token issued once by the owner.
- **A3 Typed ids still accepted at the door, logged as manual.** Rejected: a *token-only scanner* (a dead
  phone or broken camera would turn a paying guest away). Instead `checkInMethod` + `checkedInBy` + audit.
- **A4 10-tier budget.** Chosen: one-lookup role checks, validate-only-what-changed, one helper call per
  tier with size dispatch. Rejected: fully inlined unrolled tier checks (measured costlier), lowering
  MAX_TIERS (UI promise), dropping tier validation (hygiene the owner asked to keep).
- **A5 Missing dateMs.** One-click fix reusing the form's own conversion (`formDateMs(eventToForm(e))`).
  Rejected: guessing a date or silently backfilling.


## Host overlay: browser extension considered, not built (2026-10-09)
- **Verified:** the real overlay renders in a real Document PiP window in headless Chromium 153 and in
  Playwright's Firefox 155 (both expose `documentPictureInPicture`), with the page styles copied and the
  window staying open while another tab is focused. The popup fallback (`window.open('/host/overlay')`)
  opens in Firefox. WebKit would not launch here (missing system libraries), so Safari is unverified by
  engine; the code feature-detects, so a browser without the API gets the popup. TV cast cannot be
  tested here: screen/desktop cast shows the PiP window, a single-tab cast does not (the overlay is its
  own window). The host console already says to cast the whole screen.
- **Extension (MV3 content script that injects the overlay into the race tab when the host reveals).**
  Would fix the one real gap: tab-cast capture. Rejected for now because it needs store distribution or
  load-unpacked on the host's machine, its own read credential (an iframe of the site is third-party
  storage, so the host's sign-in is not visible; it would need a read-only overlay capability token and a
  new rules surface), and a second code path to keep in step with the PiP overlay. Revisit only if hosts
  cast a single tab rather than the screen.
- **Chosen:** keep PiP with the popup fallback. The host's click on "Open overlay" is the reveal (Chrome
  requires a user gesture to open a PiP window, which a remote signal cannot give).

## Link-gated quiz, lap-based window, live-quiz mode (2026-10-09)
- **Public quiz vs link-gated.** Kept the quiz out of the public site: a capability token in the URL (`playLinks`) is the only way in. Rejected: a signed-in-only quiz (attendees would need accounts at a venue with poor signal), a venue geofence (not enforceable in a browser), and a per-table QR for players (it let attendees re-share the entry point, against the host-only rule).
- **Window by laps, not minutes.** Close = 30% of the race measured from when lights actually go out, with the host's live lap count as the ground truth. Rejected: a fixed wall-clock close (a delayed or red-flagged race would eat the quiz), and reading the lap from the free OpenF1 API (it has no data from 30 minutes before to 30 minutes after a session). The paid feed is built and dormant (R63).
- **Live quiz pointer.** Auto mode derives the quiz client-side from booking events (no scheduled function, no backend). Rejected: a Cloud Function updating `settings/active` (no backend in this project) and removing Manual (hosts need an override when two parties fall on one night).
- **Auto results pull.** Fills a draft, never publishes. Rejected: publishing on pull (a wrong or partial OpenF1 answer would score every player on the spot).
- **Unused rules helper.** `activeId()` in `firestore.rules` ignores Auto mode and has no callers; do not use it in new rules.

## Profile quiz history (2026-10-09)
- **Own entries via a collection-group query.** `events` list is host-only, so `listOwnEntries` queries `entries` by uid (R66). Rejected: client-side remembered event ids (lossy across devices and cleared storage), deriving from bookings (bookingEvents are unreadable once sales close), a denormalised list on `users/{uid}` (a new write surface to guard).

## Phone and locked picks (2026-10-09)
- **Phone moved to Profile; picks are final.** Rejected: keeping the briefing but persisting the 'confirmed' flag in localStorage (still shows a screen to every new player and puts a profile chore in a time-boxed quiz) (R67). Rejected: edit picks until the window closes, which the previous build allowed (R68).

## Host open/close controls (2026-10-09)
- **One state machine drives both host surfaces (R69).** Rejected: deleting RaceControl's quick toggle (the console top needs a one-tap open/close); kept, but it now renders `quizControlState` exactly like Live controls. Rejected: leaving `deriveStatus` trusting override 'open' (the UI showed OPEN while firestore.rules refused every entry before 10 min pre-lights-out).

## Manual/Auto quiz window (2026-10-09, R70)
- **Keyed on the host's explicit override, not on the mode.** The rules cannot read `settings/active.mode` within the expression budget, and the host is trusted. Rejected: a mode check via an extra `get` in `acceptingEntries` (budget and an extra read per entry write); removing the 30% rule in Manual (the user wants it overridden, not deleted); letting plain Open now drop the lap rule (the lap rule is lifted only when the close is pushed past the cap).
- **Leaving 'open' pulls the window back** (`setOverride`): a close past the cap is legal only while override is open, so Close now and Clear override clamp closesAt in the same transaction rather than being rejected.
- **Auto's 10-minute lock is a UI gate**, plus the scheduled open. Rejected: enforcing it in rules for Auto only.

## OpenF1 live-data cost (2026-10-10)
- **Cost of the paid tier, seen at OpenF1's checkout (screenshot, 2026-10-10):** "real-time data access (personal use)" = **INR 1,115.98 per month**, billed monthly, tax INR 0, via Stripe. Priced in EUR too (1 EUR = 112.725 INR incl. 4% conversion fee, so the INR charge varies with exchange rates). Includes REST API up to 6 req/s and 60 req/min, plus MQTT and WebSockets (up to 10 concurrent). Earlier research put it at EUR 9.90/month (`docs/research/fastf1-ideas.md`); consistent.
- **Why it matters:** on 2026-10-10 the free tier gave nothing to the race page during the sprint, because the whole Results block hangs on one OpenF1 session-list call that is refused inside the live window (30 min before to 30 min after a session). The paid key is what lifts that blackout; it is the price of live data.
- **Status:** NOT subscribed as of this note (checkout page only). R63 still holds: free API now, paid feed built but off, switch-on is configuration only. Note: the tier is "personal use"; the site is a club with paid ticketing, so check OpenF1's terms before putting the key behind a public site.
- **Alternative that costs nothing:** take the weekend schedule out of the live OpenF1 path (bundle or snapshot it), so session times and weather survive the blackout. Not built yet; results/classification would still wait for the window to close.
- **Licensing inquiry sent to OpenF1 (2026-10-10), awaiting reply.** Asks: is hobby/club use OK under the "personal use" plan (incl. a later paid freelance handover), do paid in-person watch-party bookings affect the licence (the F1 data is never paywalled), legal/attribution requirements, server-side proxy + caching, and whether the rate limits are per account or per IP. Do NOT subscribe, deploy the Worker with the key, or put the key behind the public site until they answer. Record their answer here and in `rules.md`.
- **Rejected: self-hosting the open-source OpenF1 (br-g/openf1) for the live data.** It ingests F1's own unofficial live-timing feed via `fastf1_livetiming` (optional `F1_TOKEN` from an F1 TV account, ~4-day validity), so it does not remove F1's rights over the data; the repo is itself CC BY-NC-SA 4.0 (non-commercial, share-alike); and it needs MongoDB + an always-on ingestor + a way for the site to reach it. Fine for local experiments only; never feed the public site from it, never use a personal F1 TV token on the site.

## Overlay content scope finalised; page-transition timing centralised (2026-10-11)
- **Live overlay is QR + countdown only**, at both size presets (compact 360x220, wide 640x300). The
  player count, leader and standings that an earlier build showed were removed at the owner's request;
  "wide" now differs from "compact" only in size, not content. `src/host/overlay/LiveOverlay.tsx`,
  `overlayModel.ts` `SIZE_PRESETS`.
- **Page-transition timing lives in one place**, `PAGE_TRANSITION_MS` (`src/lib/motion.ts`): `cover` (the
  panel sweeps over the old page), `hold` (screen stays fully covered so the route label is readable
  and the next page loads behind it), `reveal` (the panel clears, the new page glides in). Every
  transition kind shares these three numbers (`TIMING` in `src/guest/transitions/variants.ts`); only the
  graphic differs. `PAGE_BUDGET_MS` is their sum, not a fixed ceiling. The R40 section of
  `docs/HANDOFF.md` predates this (it lists an old 350ms/150ms scheme from before the redesign) — treat
  `src/lib/motion.ts` as the source of truth for current timings, not that doc.
