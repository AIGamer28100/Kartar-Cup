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

## 3. Agent status (snapshot 2026-10-07; both agents were still running)
Verified at snapshot: `npx tsc -b` clean, `npx vitest run` 443 passed. Rules tests, `vite build` and `npm run lint` were NOT re-run at snapshot.
Note: the first Opus and first Haiku agents were stopped by an interruption and could not be resumed; fresh agents were started on the same briefs.
Messages about commit/push cadence were first sent to the wrong agents (ids swapped) and then corrected; check that neither agent committed the other's tree.

### Haiku agent (main checkout, branch `worktree-build-v1`, pushes there)
| Task | Status |
| --- | --- |
| 1 Rules tests (cards tests fixed, event-cancel / no-delete / checked_in-cancel tests) | NOT CONFIRMED: run the rules command (section 1) and check `tests/rules/cards.rules.test.ts` + new cancel tests |
| 2 Play cards by reference (`toSnapshot`, `getCard`, MyCards) | IN PROGRESS: `src/guest/MyCards.tsx` has uncommitted edits; verify `toSnapshot` drops image/imageUrl |
| 3 Host "Cancel event" UI (BookingsAdmin) | PARTLY DONE: "Cancel event" present in BookingsAdmin; verify confirm panel, progress, Cancelled badge, "Finish refunds", cancelled-event read-only form |
| 4 Leftover seats (`distributeLeftoverSeats`) | PARTLY DONE: function exists in `src/host/bookings/model.ts`; verify it is applied in formToEvent, the blocking validate error is gone, info note shows, tests exist |
| 5 Remove last-lap (`src/lib/raceState.ts`) | DONE (no `last-lap` left in that file); confirm its tests were updated |
| 6 WhatsApp hook | DONE for the hook (`src/lib/useCommunityLink.ts`); ContactPage wiring to verify (Opus also did footer/home) |
| 7 Lint | MOSTLY DONE: `eslint.config.js` + `"lint": "eslint ."`; uncommitted edits in eslint.config.js/package.json; confirm `npm run lint` has 0 errors |
| 8 Docs | DONE: README "Terms and Privacy placeholders" (5.1) and event cancellation notes; rules.md R44 states 5 s |

### Opus agent (isolated worktree `.claude/worktrees/agent-adaa5e2bac746cb82`, branch `motion-results-v2`)
| Task | Status |
| --- | --- |
| Audit/finish motion on all public screens | PARTLY DONE (inherited from first Opus work already merged in 3c84dce; more commits on its branch) |
| 3D track layout, stepped podium | DONE and merged earlier (3c84dce); needs a visual re-check |
| F1-style results hub on RaceDetailPage | IN PROGRESS: commit "Race detail results hub: session tabs, F1-style classification and team tables, fastest lap" (new `src/guest/results/`, `resultsModel.ts` + tests); RaceDetailPage/raceData/motion.tsx have uncommitted edits |
| WhatsApp from settings in footer/home, hero race-state left-aligned, tick rates per state | DONE per commit 4e68070 |
| Ticket QR encodes `qrToken` (TicketView/BookingCheckout) | NOT CONFIRMED |
| Cancelled-event display (EventsPage, BookingCheckout, TicketView) | NOT CONFIRMED |
| Checkout `col-span-12` + no double booking on payment retry | NOT CONFIRMED |

### Leftovers from the FIRST (stopped) Opus agent
Its uncommitted edits were saved to branch `motion-redesign` (commit c50c0ca: BookingCheckout, ContactPage, CupPage, GalleryPage, ProfilePage, TicketView, tokens.css). These may overlap with the new agent's work: when merging, prefer `motion-results-v2` and cherry-pick only what is missing (`git diff worktree-build-v1 motion-redesign -- <file>`).

## 4. How to resume (cheapest order)
1. `git status`, `git log --oneline -10`, `git worktree list`. Commit any leftover Haiku work (plain message) after
   `npx tsc -b`, `npx vitest run`, rules tests, `npx vite build`, `npm run lint` all pass.
2. Merge the Opus branch if present, resolve conflicts (it avoided host/rules/bookings files), re-run the same checks.
3. Push, then update PR #1. Open items below.

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
