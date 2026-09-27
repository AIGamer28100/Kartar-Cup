# Handoff — Kartar CUP (updated 2026-09-27 ~09:55 IST)

Worktree: /home/hari/kartar-cup/.claude/worktrees/build-v1 (branch worktree-build-v1, no remote, NOT merged to main). Firebase project: kartar-cup-baku (Firestore Standard, asia-south1; Google sign-in enabled; anonymous NOT enabled). NOT DEPLOYED: production deploy was blocked by the auto-mode classifier; user must run:
`npx -y firebase-tools@latest deploy --only firestore:rules,hosting --project kartar-cup-baku` (then add hosts/hariharankvasn@gmail.com doc, set active event in /host/settings).
Local preview (user is looking at it): Vite on :8000 + emulators (auth 9099, firestore 8080, project demo-kartar-cup), seed with `npm run seed`. NEVER run `npx playwright test` or `npm run test:rules` while the preview must stay up (they kill 8080/9099); restart after: emulators `npx firebase emulators:start --only auth,firestore --project demo-kartar-cup`, then seed, then `VITE_USE_EMULATORS=true VITE_FIREBASE_API_KEY=demo-key VITE_FIREBASE_PROJECT_ID=demo-kartar-cup npx vite --host --port 8000 --strictPort`.
Budget lesson: parallel agents exhausted the 5h session in minutes. Run ONE agent at a time, Sonnet/Haiku only, no repeated screenshots.

## Read first
rules.md (R1-R17), decisions.md, docs/superpowers/plans/2026-09-26-phase-a-plan.md, docs/research/{fastf1-ideas,booking-analysis}.md.

## Done and verified (by me)
Data layer + rules (55/55 rules tests, 34+ unit tests, build), Google-only entries (R14), settings page, guest flow with R13 auto open/close window, responsive redesign (hero rebalanced), sign-in bug fixed (authDomain), real circuit outlines for all 33 races (src/config/tracks, bacinger MIT), calendar catalog 2026-27.

## STATUS at 09:55 IST (session was 97% used, resets 13:50 IST)
N1 routing + R18 (no host login UI) DONE: commits ed6f817, 1408e81, f664b45. Verified by me: build clean, 69/69 unit, 55/55 rules. Full Playwright suite was RUNNING in background (output /home/hari/.claude/jobs/abdef116/tmp/pw.txt): read its pass/fail summary first. AFTER IT FINISHES the local preview is DOWN: restart emulators + seed + vite :8000 (commands above). New rule R19 (quiz answers from F1 official + FastF1) is logged, not built.

## In flight / stopped (older notes)
- N1 routing agent (running): guards, skeletons, failure page, Invalid path page, /logout. Told: NO /login page; hero CTA 'Get on the grid' = direct Google sign-in (R16). Verify: build, vitest, then I run playwright suite (kills preview ports).
- V1 calendar validation (STOPPED early, check git status for partial edits under src/config/calendar, scripts/): validate races/venues/session UTC times via FastF1 + F1 livetiming index + Jolpica + formula1.com; replace buildDefaultEvent's guessed 13:00Z start.
- P1 big-screen podium (STOPPED before doing much; check git status): host-only /host/screen, modes lobby/standings/podium, stages P3->P2->P1 advanced ONLY by host (keyboard + PodiumController + events/{id}/screen/state host-only doc), Google photoURL on entries (regex lh*.googleusercontent.com), F1 podium animation, QR lobby.

## Next, in order (one agent at a time)
1. N1 finish -> verify (build, vitest, playwright suite) -> restart preview.
2. Wire real TrackMap into guest hero by event raceId (hero file owned by N1 area).
3. V1 rerun (Sonnet, narrower), then P1 podium.
4. History + own-stats page (R15: per-user docs users/{uid}/attended/{eventId}, host-written at reveal, guest reads own only).
5. Booking page + settings management (venues, tiers, discounts, per-venue pricing): see booking-analysis.md; payment approach proposed = reservation + host-set payment link (no server-side payments); ask user to confirm.
6. /stats page (crowd-vs-reality etc.: HOST-ONLY per R15).
7. Housekeeping: strip Co-Authored-By from commits eef6a1b and 3291f98; never add attribution (global CLAUDE.md hard rule). Merge branch to main only after user review.

## Booking research facts (verified by agent, cite booking-analysis.md)
Only live Karter Cup price found: F1 Watchparty Monza GP, Eshkol Event Space (Nungambakkam): Single INR 399, Duo 798, Group of 4 1,596, includes paddock passes, driver cards, snacks, games, prizes (linktr.ee/teamkartercup). NOT verified anywhere: 19 Apr karting date, ECR Speedway, INR 2,999, KYNhood booking (came from an unverified pasted summary). Comparable watch parties: INR 299-650, mostly non-refundable, fees ~75 flat + 5% on one platform.

## Needed from user
Deploy command run; WhatsApp community link (or set in /host/settings); confirm payment approach; price/venue list for booking.
