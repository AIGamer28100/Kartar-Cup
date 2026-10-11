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

## 4.1 DEPLOYED 2026-10-07
Hosting (https://kartar-cup.web.app) and Firestore rules were deployed together from `worktree-build-v1` (commit 57d18fd) with the public Firebase web config
(fetched via `firebase apps:sdkconfig`). NOT set at build: `VITE_PLACES_PROXY_URL` (venue search shows "not configured" until the Worker is deployed and
the site rebuilt, README section 4). Tier counters start at 0 for events that already sold tickets.
Still open from section 5: rotate the leaked Maps key, revoke the pasted Firebase CLI token, deploy the Cloudflare Worker.

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

## 4.2 Places proxy DEPLOYED 2026-10-07

The Cloudflare Worker that hides the Google Places key is live at
`https://kartar-places-proxy.hariharankvasn.workers.dev` (account `4f4a767e5b1eaf0b4f60f876e76d5839`).

What changed:
- The Google key is no longer in any `.env*` file. A `VITE_`-prefixed copy was sitting in `.env` and
  `.env.local`, which is exactly the namespace that reaches the browser. Its only two homes now are
  `worker/places-proxy/.dev.vars` (local, git-ignored) and the Worker secret (production).
- `wrangler` pinned as a devDependency; `npm run worker:dev | worker:secret | worker:deploy | worker:smoke`.
- `scripts/smoke-places-proxy.mjs` asserts the Worker's security properties; `scripts/deploy-worker.sh`
  does secret + deploy in one pass, reading credentials from `worker/places-proxy/.cf.env` (git-ignored).
- `.env.production.local` carries `VITE_PLACES_PROXY_URL`, so the next `npm run build` wires it in.
- Verified against the deployed Worker, 7/7: no token -> 401, off-list origin -> 403, bad token -> 401,
  non-GET -> 405, preflight -> 204 for kartar-cup.web.app, unknown path is not a tunnel, no key in any body.
- Verified in `dist/`: the only `AIza` string is the Firebase web key (public by design). The Places key
  is absent.

STILL OPEN:
- **The key is the leaked one.** It is in this repo's PUBLIC git history (`cf2a8f3` removed it from
  `src/lib/mapEmbed.ts`). The owner chose to reuse it rather than rotate. Anyone reading that history can
  bill the project through it once the referrer lock is off.
- **Its referrer restriction must be removed by hand**, in the Google Cloud console, by the owner: the
  Places *web service* rejects referrer-restricted keys outright (`REQUEST_DENIED`, "API keys with referer
  restrictions cannot be used with this API" — re-tested against Google on 2026-10-07). Until then venue
  search returns REQUEST_DENIED through the Worker. Mitigations worth taking at the same time: narrow the
  key's API list to Places API only (it currently allows 33), and set a daily quota cap on Places API.
- **Hosting not yet rebuilt** with `VITE_PLACES_PROXY_URL`, so production venue search still reads
  "not configured" until `npm run build && npm run deploy` runs.
- The authenticated half of the smoke test is unrun: it needs a host's Firebase ID token
  (`PLACES_TEST_ID_TOKEN=<token> npm run worker:smoke`).

## 6. QUEUED: clean-room specification set (requested 2026-10-08)

After the in-flight work lands, write a fresh specification set describing the application **as actually
built**, derived ONLY from the current source. Explicitly NOT from `docs/`, the old PRDs, `rules.md`,
`decisions.md` or this file — the user's point is a clean-room description of what exists, because
planning docs drift and the code does not.

Destination: a new `spec/` directory at the repo root, **git-ignored** (add to `.gitignore` before writing).
Six files, within the 5-8 limit the user set:

| file | covers |
| --- | --- |
| `spec/01-prd.md` | what the product is and does, feature by feature, as built |
| `spec/02-architecture.md` | system shape: Vite/React SPA, Firebase Auth+Firestore+Hosting, the one Cloudflare Worker, no backend, data flow |
| `spec/03-technical-spec.md` | data model (`src/lib/types.ts`), collections and subcollections, external APIs (OpenF1, Jolpica, Open-Meteo, Google Places), build and deploy |
| `spec/04-security-spec.md` | roles and capabilities (`src/lib/roles.ts`), every `firestore.rules` invariant, the Places Worker's auth, refund/capacity enforcement |
| `spec/05-ui-ux-spec.md` | design tokens, layout system, host vs public treatment, motion rules, accessibility posture |
| `spec/06-user-flows.md` | guest and host journeys end to end: sign-in, booking, ticket/QR, check-in, quiz, scoring, big screen, cup |

Sources permitted: `src/**`, `firestore.rules`, `worker/**`, `tests/**`, `package.json`, `scripts/**`.
KNOWN TRADE-OFF to state in the docs: written from code alone, these capture WHAT and HOW faithfully but
are thin on WHY. `rules.md` and `decisions.md` remain the record of intent and rejected alternatives; the
new set should say so in one line rather than silently re-deriving a different rationale.

## 7. DEPLOYED 2026-10-08

All three surfaces, verified live:
- **Hosting** https://kartar-cup.web.app — the served `index-*.js` hash matches the local build exactly.
- **Firestore rules** released (rules tests 7 files / 305 passing immediately before release).
- **Cloudflare Worker** `kartar-places-proxy` redeployed; security smoke 7/7 against the production
  origin (no token 401, off-list origin 403, bad token 401, non-GET 405, preflight 204, unknown path
  no tunnel, no key in any body).

Built with `VITE_MOCK_LAB_UNTIL=2026-10-08T18:30:00Z` (end of 2026-10-08 IST), so the dev Mock Lab
ships at /race-state-mock for today only. Confirmed live: the route renders and the expiry string is
served in `App-*.js`. The bundle grew 2.2M -> 2.9M because the captured F1 fixtures ship with it.

**TOMORROW, to take the harness back out** (the expiry reads the VISITOR'S clock, so it is a
convenience, not a control — a changed clock still reaches the page):
```bash
npm run build && npm run deploy      # with VITE_MOCK_LAB_UNTIL unset
```
With the variable unset Vite folds the gate to `null` and Rollup drops the whole `src/dev` subtree,
so the harness and its fixtures leave the bundle entirely. Verify with:
`grep -rl "race-state-mock" dist/assets` (expect no output).

Risk accepted while it is up: the harness has NO privileged access — it renders fixtures, and
anything it touches in Firestore is still subject to `firestore.rules`. No secrets ship with it
(verified: 0 occurrences of the Google Places key in `dist/`).

STILL OPEN after this deploy:
- **Venue search is still dead in production.** The Google Places key keeps its HTTP-referrer
  restriction, which the Places web service rejects outright. One click in the Google Cloud console
  (Application restrictions -> None, then Save) fixes it; nothing in the code can.
- Rules now fail closed on refunds for booking events with no `dateMs` (legacy docs): re-save an
  event once to populate it.
- A 10-tier event already exceeds the 1000-expression rules budget for a non-super-admin host edit
  (pre-existing, see the implementation note in rules.md).
- `tests/e2e/settings.spec.ts` still targets the removed /host/settings screen and will fail.

## 8. DEPLOYED 2026-10-09 (Mock Lab taken out)

Hosting only (UI change; rules and Worker untouched, still as released in section 7). Built with
`VITE_MOCK_LAB_UNTIL` unset, so the Mock Lab is **dev-only again**: `/race-state-mock` on
https://kartar-cup.web.app now falls through to the app's "Invalid path" page, `race-state-mock` appears
nowhere in `dist/assets`, no harness or fixture files ship, and the bundle is back to 2.2M. The served
`index-BGetIbug.js` matches the local build. (A request for a missing asset path returns `index.html`
with a 200 because of the SPA rewrite: that is not the harness.)

Shipped in this deploy: the Previous race card with the winner's head shot (sized portraits from the F1
CDN), the head-shot podium on the home page and the race page, the race page rebuilt as two columns
(stacked before any results) with a session card per tab and the track card absorbing the circuit facts
and elevation, Tyres removed, the Drivers / Constructors switch beside the session tabs, and the 2027
season shown as cards (the R33 timeline deleted; only the real next race says "Next").

To run the Mock Lab again locally: `npm run dev`, then open `/race-state-mock` (it is gated on
`import.meta.env.DEV`). To put it on a deployed site for a day, build with
`VITE_MOCK_LAB_UNTIL=<ISO time>` and remember the expiry is read from the visitor's clock.

STILL OPEN (unchanged): venue search in production waits on the Google Places key's referrer
restriction (one console click); `tests/e2e/settings.spec.ts` targets the removed Settings screen; the
five guest e2e tests need the emulator and `.env.e2e`.

## 9. HANDOFF 2026-10-09 (written before /compact): quiz overhaul, nothing committed, nothing deployed since section 8

**Verified green at the last full check (before the final 3 agents restarted):** `npx tsc -b` clean, `npx eslint src` 0 errors, `npx vitest run` 58 files / 678 tests, `npm run build` OK (Mock Lab absent: `VITE_MOCK_LAB_UNTIL` unset), rules suite 8 files / 344 tests, 0 skipped (`npx firebase emulators:exec --only firestore --project demo-kartar "npx vitest run --config vitest.rules.config.ts"`). ALWAYS type-check with `tsc -b`, never `tsc --noEmit -p .`.

**DONE this session (uncommitted):**
- Footer Explore nav removed; mobile tab bar = Home / Events / Profile (Predict tab and race strip deleted with the public quiz).
- Quiz moved OFF the public site to `/play/<token>` (capability link: `src/lib/playLinks.ts`, `src/lib/token.ts`, `src/guest/PlayPage.tsx`, host panel `src/host/bookings/QuizShare.tsx`: create/copy/QR/revoke). `firestore.rules`: `playLinks/{token}` (get public, list host, host create/revoke only), entries require a valid unrevoked `accessToken`, `events` list host-only, `acceptingEntries` no longer needs `settings/active`.
- Quiz window (owner rules): opens 10 min before scheduled lights out; closes before 30% of the race: by LAP COUNT (`floor(0.3 x totalLaps)`, host-entered `liveLap`) with a clock backstop (18 s per race minute from the REAL start `raceStartedAt`); a delayed, not-yet-started race (`delayed`) holds the quiz open. Code: `src/lib/quizWindow.ts`, `eventStatus.ts`, `db.ts` (startQuizRace / setQuizDelayed / setLiveLap, saveEventConfig is now a transaction), host UI `LiveControls.tsx` (Quiz clock) and `SettingsPage.tsx`. Rules mirror it (validEvent bounds, set-once `raceStartedAt`, lap-close in `acceptingEntries`); rules budget trims are documented inline and in rules.md.
- Quiz UI redesigned Kahoot-style (`src/guest/quiz/**`, `Quiz.tsx`, `GuestApp.tsx`, `PicksCard.tsx`); the agent's "share with your table" QR was REMOVED (only the host shares the link).
- Host-only live overlay (Document Picture-in-Picture, popup fallback `/host/overlay`): `src/host/overlay/**`, mounted in HostApp, panel in HostConsole. Real always-on-top behaviour, TV cast, Firefox/Safari fallback UNVERIFIED.
- Paid OpenF1 live feed made pluggable and DORMANT: `worker/openf1-live/` (not deployed), `src/lib/liveRace/**`, "Auto lap" toggle in LiveControls (disabled until `VITE_OPENF1_LIVE_URL` is set). Switch-on steps are in `worker/openf1-live/README.md` (apply at https://tally.so/r/w2yWDb, 5 steps). Paid API UNVERIFIED (no credentials).
- Refunds/QR/scanner/rules budget: whole-event cancel always refunds; no unpaid exception; no admin override; guests cannot cancel (tested); QR is token-only ("Ticket not ready" + `ensureQrToken`); manual door check-in logged (`checkInMethod`); 10-tier events fit via cheaper rules plus chunked client saves (`src/lib/tierChunks.ts`); `dateMs` notice with one-click fix. Venue_host can no longer cancel a whole event (confirm with owner). An unpaid `reserved` booking can still be cancelled inside the refund window by a host or above (no money moves): CONFIRM with owner.
- 2027 calendar shows cards (timeline deleted, R33 superseded); only the real next race says "Next".

**IN FLIGHT when this was written (3 agents restarted after an API session limit; check `git status` for partial work and re-run the checks above):**
1. Auto-pull of quiz answers from OpenF1 after the chequered flag (`src/lib/raceResults.ts` scheduler + results screen status; host still confirms publishing). Agent id a53192dec70ef18cf.
2. Live-quiz Manual/Auto mode: `settings/active` gets `mode`; `deriveLiveQuizId` in new `src/lib/liveQuiz.ts`; LiveControls switch; ONLY the `settings/active` block of firestore.rules changes. Agent id a75894bdfa915ac8c.
3. Public-site button design pass from the audit saved at `/tmp/claude-1000/-home-hari-kartar-cup/dba14a2a-0dc7-4952-919a-58ef373b8688/scratchpad/design-audit-top.md` (copy it into the repo notes if it is needed after a reboot). Agent id ad9c51fb8cc7a3c8d.

**NEXT, in order:** (a) collect the 3 agents' reports and re-run tsc -b / eslint / vitest / rules suite / build; (b) end-to-end suite: update `tests/e2e/settings.spec.ts` (targets removed /host/settings; quiz setup is per event at /host/bookings/:eventId/quiz/*), guest specs for `/play/<token>` (seed a `playLinks` doc and send `accessToken`), the extend-closing test (a default quiz already closes at the 30% cap, so extend buttons are hidden), then run with emulators: `npx firebase emulators:exec --only auth,firestore --project demo-kartar "bash -c 'npx vite --mode e2e --port 5173 --host 127.0.0.1 & sleep 8; npx playwright test'"` (the `.env.e2e` mode file is required; kill stale vite on 5173-5175 first and restart the owner's dev server in default mode afterwards); (c) update rules.md (new rules for link-gated quiz, quiz window and lap/delay close, live-quiz mode, R58 now fully done) and decisions.md (link-gated quiz, window by laps, remove table-share QR, dormant paid feed); (d) the clean-room spec set in git-ignored `spec/` (six files, AAR section 6) written from `src/**`, `firestore.rules`, `worker/**`, `tests/**`, `scripts/**`, `package.json` ONLY; (e) build + deploy hosting AND firestore rules only when the owner says so (the rules changed: run the rules suite first; the Worker for OpenF1 live stays undeployed).

**Owner-side blockers (I was denied or it needs their login; do not retry by other means):** (1) Google Places key: Google Cloud console -> that API key -> Application restrictions -> None, Save; also narrow API list to Places only and set a daily quota (the key is in public git history, commit cf2a8f3); until then venue search returns REQUEST_DENIED. (2) Firestore wipe (keep `users` AND `hosts`; pass `--project kartar-cup`). (3) OpenF1 paid access application. (4) Decide: when "Lights out" is pressed the 30% deadline resets from the actual start and overwrites an earlier host-set close; keep the earlier close instead?
