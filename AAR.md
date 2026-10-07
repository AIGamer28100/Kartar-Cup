# After-action report (AAR): Kartar Cup audit, rules and motion work

Written so work can resume cold. Branch: `worktree-build-v1` (PR #1 on `AIGamer28100/Kartar-Cup`). Last updated 2026-10-07.
Commit messages in this repo must be plain: NO Co-Authored-By / Claude-Session trailers (owner rule). Three early commits
(0795218, 45cb98a, 5de4e75) still carry them; a force-push to clean them was offered and not yet approved.

## 1. What is DONE and pushed
- Chequered-flag track animation (TrackMap): black/white checker draw-on then running squares; home page passes race state.
- Two full audits (code + UI/UX, then a blind fresh audit of 116 items) applied: stale compiled .js removed, types fixed,
  `functions/` removed, host-only cancel, Places key moved behind a Cloudflare Worker (`worker/places-proxy`), e2e seeding
  helper (`resetAndSeed`, emulator ports in firebase.json), accessibility/token cleanups, dead code removal, README written.
- Firestore rules (tests: `npx firebase emulators:exec --only firestore --project demo-kartar "npx vitest run --config vitest.rules.config.ts"`):
  per-event tier price + discount binding, per-tier capacity counters (`bookingEvents/{id}/tierCounts/{tierId}`), guests cannot cancel,
  bump caps, verified-Google booking, qrToken separate from booking id, bumps tied to a real new booking
  (`lastReserveBookingId` / `lastBookingId`), event cancel fields, no client deletes of events/counters, cards readable by id.
- Merge `3c84dce` brought in the Opus motion work from branch `motion-redesign`: route transitions, motion primitives
  (`src/components/motion.tsx`, `src/lib/motion.ts`), 3D elevation track (`TrackLayout.tsx`, `src/lib/track3d.ts`, constant thickness,
  no graph/slider), stepped podium with real OpenF1 data (`src/lib/podium.ts`).

## 2. Owner decisions already made (do not re-ask)
- Ticket price varies per event/tier and is enforced by rules; tier capacity enforced; counters tied to a booking.
- Guests cannot cancel; only host/admin/venue_host. "Delete" a booking event means CANCEL only: records stay for audit, only the
  Firestore console deletes. Cancel flow: sales close, event shows Cancelled to guests immediately, all tickets cancelled and
  (sample) refunded, then marked settled.
- Venue search uses Google Places only, key hidden behind the Cloudflare Worker (free tier).
- Leftover seats (sum of capped tiers < event capacity) go to the tier with the fewest seats per ticket.
- "Last lap" state is removed (cannot be known from the clock). Track draw-on = 5 seconds.
- WhatsApp link must come from live event settings (not a constant). Card images referenced, not copied into bookings.
- Terms/Privacy to be filled later by the owner: README must say where (src/config/legal.ts `Op` markers).
- Events results/standings (race detail page): rebuild in the official F1 site pattern (formula1.com is blocked from here;
  session tabs + classification table + Drivers/Teams switcher, no click-to-open text link).
- Hero alignment (open question, my recommendation: left-align the race-state block, rules.md R9 says no centred hero).

## 3. Agent status: BOTH FINISHED, everything merged into `worktree-build-v1`
Final verified state of the merged branch: `npx tsc -b` clean, `npx vitest run` 460 pass, rules tests 251 pass, `npx vite build` ok,
`npm run lint` 0 errors / 9 warnings (hook-dependency warnings in RaceStateDisplay, BookingCheckout, EventsPage).
Merged: Haiku work (host cancel-event UI, leftover seats, cards by reference, WhatsApp hook, lint, docs), Opus work branch `motion-results-v2`
(F1-style results hub in `src/guest/results/`, ticket QR encodes `qrToken` + void QR, cancelled-event notices on events/checkout/ticket,
checkout full-width below 1024 px + payment-only retry, timer tick rates, WhatsApp in footer/home, left-aligned hero race state) and the
older `motion-redesign` leftovers (newer branch won every conflict). Open PR #1 (base `master`) carries all of it.

## 4. How to resume
Nothing is in flight. Remaining work is the list below plus the blockers in section 5.
Not done / owner decisions:
- Opus did not finish a full motion audit of gallery, stories, partners, about, contact, quiz, profile and page transitions (stopped to save credits).
- Cancelled events stay listed on /events with a badge while `hosted` is true: decide whether old cancelled events should drop off the list.
- Fastest-lap badge downloads the full lap list (a few hundred KB) when a race/sprint tab is opened.
- The Cancel event UI and the leftover-seats note were verified by unit/rules tests only, not clicked through in a browser; run them against the emulators once.
- Guest e2e specs are stale (see section 5); host e2e specs pass.
- Branches `motion-redesign` and `motion-results-v2` can be deleted after PR #1 merges.

## 5. BLOCKERS and risks before going live
- **Rotate the Google Maps Embed key** that was hard-coded in `src/lib/mapEmbed.ts` (removed from code, but it is in the PUBLIC repo history).
- **Revoke the Firebase CLI token** pasted in chat (myaccount.google.com/permissions, "Firebase CLI"): it can reach 12 projects.
- **Rules are NOT deployed.** Deploy only TOGETHER with the matching site build: new rules need `tierIndex`, tier counters,
  `lastReserveBookingId`/`lastBookingId` and a separate `qrToken`; the old client breaks booking. Needs `VITE_FIREBASE_*` env for the build
  and, for venue search, `VITE_PLACES_PROXY_URL` after deploying the Worker (README sections 4 and 5). Command:
  `npx -y firebase-tools@latest deploy --only firestore:rules --project kartar-cup` (needs `FIREBASE_TOKEN` env secret or login).
- **QR must encode `qrToken`** (Opus task 3a) before deploy: booking ids are now semi-public (named on counters), so a QR of the id is forgeable.
- Tier counters start at 0: set them once in the console if tickets were already sold.
- Guest e2e specs (`tests/e2e/guest.spec.ts`, `a11y.spec.ts` guest cases) target an old UI and fail; host specs pass (7 of 11).
- Terms/Privacy still contain "[operator to complete]" markers.
- Still-open lower items from the audits: WhatsApp from settings in footer/home (Opus 3e), grid auto-patching from OpenF1 can change ids after
  guests picked, tier counter/booking DoS is closed but pricing/payments are mock (`paid_mock`), no delete of booking events by design.
