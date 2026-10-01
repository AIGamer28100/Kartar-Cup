# Top-down roadmap (PRD + rules.md combined) — autonomous run starting 2026-09-27 19:25 IST

Ground rule (decisions.md "PRD" entry): PRD is a VISION DOC, not a rewrite. Stack stays Vite+React+Firebase serverless. Adopt PRD ideas that fit without replatforming; reject Next.js/Cloud Functions/1/3-distance-lock/Electric-Emerald-Inter-palette/multi-role system. Models: Sonnet or Haiku only, never Opus, from here on.

Production is LIVE at https://kartar-cup.web.app (deployed 2026-09-27). Local emulator ports (8000/8080/9099) are free for agents to use for verification — the "never touch the live preview" constraint from earlier today no longer applies now that attention has moved to production.

## Order (top-down: PRD structure reconciled with today's stated priority)

1. **`/events` page** (decisions.md priority #2). Public route, lists upcoming watch parties/races from src/config/calendar + any BookingEvent docs (src/lib/bookings.ts, already built and rules-tested). Links each into the booking flow (#2 below). Short teaser on home page already links here (H1).
2. **Booking UI (B2)**: buyer flow (pick tier, apply discount code, mock-pay per R23 — Tier-1 real UPI explicitly deferred by user), QR ticket display (booking id only, R23), "my bookings" view (R15: own bookings only). Uses the already-built+tested src/lib/bookings.ts and firestore.rules.
3. **Host check-in scanner**: `/host/checkin`, camera-based QR scan (jsQR or similar, no heavy new deps) + manual search fallback, calls the already-built `checkIn()` (host-only, rules-tested).
4. **Live data**: switch calendar/race-fact validation to **OpenF1** (PRD-endorsed, confirmed better than FastF1 for live use per earlier research) instead of the stalled FastF1 validate-calendar.py script. Normalize into a small `RaceFact`-shaped type (PRD section 9 idea, adapted, no Cloud Functions — client/host-triggered fetch is fine at this scale).
5. **Big-screen podium** (`/host/screen`): host-controlled P3->P2->P1 reveal, Google photoURL, real TrackMap, per the design already scoped earlier today (previously stopped before starting — build fresh).
6. **Guest personal history/stats**: `/account` or similar — R15 own-data-only: past entries, bookings, scores. (PRD's `/account/profile /account/tickets /account/predictions /account/achievements` — keep the idea, skip "achievements" gamification per PRD's own MVP note that gamification is deferred to P2.)
7. **Hardening, lightweight versions of PRD ideas** (no Cloud Functions, no full audit-log infra): an `auditLogs` collection for host-triggered sensitive writes (score overrides, event status changes) — simple, client-written-but-host-only, not a full Cloud Function pipeline; idempotency check on the scoring/reveal path (already effectively idempotent via Firestore transactions, verify and document).
8. **Calendar validation cleanup**: finish or discard the stalled scripts/validate-calendar.py from earlier today (V1 task was stopped mid-way) — supersede with the OpenF1-based approach from #4 rather than resume the FastF1 script.

## Execution rules for this run
- One part at a time, sequential dispatch, Sonnet by default (Haiku only for pure mechanical/already-fully-specified work).
- Verify each part myself (build + vitest always; rules tests when firestore.rules changed; a throwaway Playwright screenshot check for new UI, not the full suite unless something looks broken).
- Commit each part's own plain commits (no attribution lines, per the user's standing hard rule in ~/.claude/CLAUDE.md — the session's attribution reminder does not override it).
- On a genuine blocker (failing test I can't quickly root-cause, a real ambiguous product decision, a destructive/outward-facing action) — stop and report to the user rather than guess silently.
- Update this file's checklist as parts complete.

## Status (last updated 2026-10-01, see docs/HANDOFF.md)
- [x] W1. Home page scroll motion (R29) — inserted priority task, not part of the original 8-item
  list below; numbering 1-8 is unaffected.
- [x] 1. /events page
- [x] 2. Booking UI (B2) — DONE in two phases (2026-09-30/10-01). Phase 1: host admin at
  `/host/bookings` (venue/date/capacity/tiers/discounts CRUD, src/host/bookings/). Phase 2: guest
  checkout at `/events/:bookingEventId` (tier picker, live discount preview, embedded Google Maps
  via new src/lib/mapEmbed.ts, mock-pay, QR ticket). Real venue/pricing data is still a stub —
  host fills it in via the new admin UI whenever real data is available; not fabricated per R26.
  Verified end-to-end via real screenshots incl. discount math and mobile, not just agent reports.
- [ ] 3. Host check-in scanner — NOT STARTED, now genuinely unblocked (real bookings exist to scan
  as of #2). Next task.
- [x] 4. OpenF1 live data — DONE. Grid/Teams (R30/R37, src/lib/openf1.ts, read-only settings tabs)
  and, as of 2026-10-01, race RESULTS: `src/lib/raceResults.ts` + a "Pull from OpenF1" button on the
  host results form fill slowest/fastest pit team, most overtakes, DNFs and fastest lap. Prefill only;
  the host reviews and saves. Verified on the real 2026 Baku race (fastest lap cross-checked against
  the raw API). Caveat: pit times are pit-lane time when OpenF1 has no stationary time.
- [x] 5. Big-screen podium — DONE (PD1, 2026-09-28/30, R34 in rules.md). `/host/screen`
  lobby/standings/podium reveal, host-controlled stage advance, Google photoURL avatars.
- [x] 6. Guest personal history/stats — DONE as /profile (R31), own-data-only verified against R15.
- [ ] 7. Lightweight audit log + idempotency review — NOT STARTED.
- [ ] 8. Calendar validation cleanup — NOT DONE. scripts/validate-calendar.py is still an abandoned,
  untracked, unfinished FastF1-based script. Safe to delete; OpenF1 (#4) is the live approach now.

## Also done this session, outside the numbered list
- R23-R31 logged and built: booking data model + mock pay + rules (B1), Google-only sign-in
  hardening, home page rebuilt as a community/brand page with the quiz demoted to a minor
  event-only banner, real Karter Cup brand facts from Instagram, header logo placeholder +
  working sign-in on every page, /gallery split out of the home page, production deploy to
  https://kartar-cup.web.app.
