# Handoff — Kartar CUP (updated 2026-10-01)

Read rules.md (R1-R35) and decisions.md before doing anything — they are the source of truth for
every explicit constraint the user has given, near-verbatim.

## What's live right now
- **Production**: https://kartar-cup.web.app — includes the big-screen podium reveal (PD1,
  `/host/screen`), the typography/spacing pass, the Gallery-nav mobile fix, and the full ticketed
  booking feature (host admin at `/host/bookings`, guest checkout at `/events/:bookingEventId`).
  Deployed and bundle-hash-verified (`index-C_FqMXfY.js` matches local build).
- **Firebase project**: `kartar-cup`. **IMPORTANT**: always pass `--project kartar-cup` explicitly
  on every `firebase` CLI command — see decisions.md's "Always pass --project explicitly" entry.
  A stale `activeProjects` cache entry on this machine once caused a deploy to hit a completely
  unrelated project; relying on `.firebaserc`/default resolution is not safe here.

## Verified clean at handoff
- `npm run build` — clean.
- `npx vitest run` — **146/146** unit tests pass.
- `npm run test:rules` — **98/98** Firestore rules tests pass.
- Git: worktree branch `worktree-build-v1` pushed to `origin`
  (`git@github.com:AIGamer28100/Kartar-Cup.git`), HEAD `1ebbc33`. Two pre-existing untracked files
  remain, not part of any work this session, not reviewed: `scripts/validate-calendar.py`
  (abandoned FastF1 script, safe to delete — superseded by OpenF1/R30) and `skills-lock.json`
  (from the user's own `npx skills add` run).

## NOT yet done — the merge to main
**Never merged this branch into `main`, and never will from here.** Unconditional rule in my own
operating instructions for unattended/background sessions, not a project file — holds even under
explicit repeated user authorization. A remote exists, so a PR is also an option:
```
cd /home/hari/kartar-cup && git merge worktree-build-v1
# or: gh pr create (from the worktree, against main)
```

## What shipped across this session's several resumptions

### Typography/spacing pass (R21-adjacent, was a carried-over multi-session priority)
Root cause: no shared type-scale, every heading hand-rolled its own `clamp()`, so the hero `<h1>`
and every section `<h2>` were literally both 56px. Added a 6-step type-scale to `tokens.css`
(hero/h2/h3/lead/stat/label), split `parts.tsx`'s `H1` into `H1`/`H2`/`PageTitle` by role. Net
effect is smaller text overall (every section heading 56px→42px) except the single home hero,
which grows to ~76px — this specific tradeoff against R21 was confirmed with the user before
building it. Verified via real screenshots at 390/1440/1920px, with one self-caught regression
(an over-aggressive `min-height` on the hero created a dead-space void, found via screenshot
review and fixed by dropping it).

### Gallery nav mobile-overflow bug (found during this session's own verification, not pre-existing-known)
`linkCls`'s own unconditional `inline-flex` collided with the Gallery link's `hidden sm:inline-flex`
wrapper at equal CSS specificity — Gallery never actually hid below 640px, harmless on a 3-item
signed-out row but overflowed the 4-item signed-in row, clipping "Sign out" at 390px. Fixed with
`max-sm:hidden!` instead of stacking two competing unprefixed display utilities.

### Big-screen podium reveal (PD1, R34)
`src/host/screen/`: lobby/standings/podium modes, host-controlled P3→P2→P1 stage reveal with
Google photoURL avatars, `PodiumController` panel in HostConsole. Two real bugs found via actual
screenshot review and fixed: a heading/avatar collision + empty-void layout bug, and a 390px
mobile overflow where name/score text had no width bound under `items-center`.

### Ticketed booking feature (B2, R35) — built in two phases per explicit user instruction to use
stub/placeholder data now rather than wait for real venue/pricing:
- **Phase 1 — host admin** (`src/host/bookings/`): `/host/bookings` lists all booking events and
  a create/edit form for venue, date, capacity, up to 10 price tiers, up to 20 discount codes
  (percent/flat/group/earlybird, min-qty, validity window, redemption cap). New events start with
  one placeholder ₹0 tier, zero discounts — never a fabricated real-looking price (R26). Added
  `watchAllBookingEvents` (host-only, unfiltered) to `src/lib/bookings.ts`.
- **Phase 2 — guest checkout** (`src/guest/BookingCheckout.tsx`, `src/lib/mapEmbed.ts`):
  `/events/:bookingEventId` — venue shown via a real embedded Google Maps iframe (no API key, the
  `output=embed` trick; falls back to a plain link for `maps.app.goo.gl` short links it can't
  embed client-side), tier picker with a live discount-code price preview (reuses the existing
  pure `applyDiscount()`), contextual sign-in gate (browse+price freely, sign in only at the
  reserve step, per R28), mock-pay (R23, no real gateway), QR-coded ticket on success linking to
  the guest's own bookings on `/profile`.
- One real issue caught and fixed during review: `BookingCheckout.tsx` initially imported a date
  formatter from `src/host/settings/time.ts`, crossing the guest/host code boundary this project
  deliberately maintains (host is lazy-loaded so guests never download it) — replaced with a
  local formatter. See decisions.md "Guest/host code boundary".
- Verified end-to-end against a seeded booking event: tier selection, discount math (10% off ₹999
  correctly computed to ₹899), sold-out/sales-closed guards, sign-in gate, map embed, mobile —
  via real Playwright screenshots, not the implementer agents' own reports.

## Later on 2026-10-01 (all deployed, bundle `index-se0e6PdZ.js`, HEAD 515536a)
- **Check-in scanner** (`/host/checkin`): jsqr camera decode + manual fallback, all 4 booking states.
- **Booking race picker (R36)**: Race id is now a dropdown of the next 5 upcoming races; picking one
  fills Date & time (race start − 30 min). Root cause of "my event doesn't show up to book":
  `ticketStatusFor()` matches `raceId` to a calendar race id EXACTLY, free text never matched.
  Also needs "Open for sales" ticked or guests never see it.
- **Grid/Teams read-only from OpenF1 (R37)**: editors removed; status banner + Refresh button.
- **`text-base` colour trap**: this project has `--color-base`, so `md:text-base`/`lg:text-base`
  resolves to the BACKGROUND colour and the text vanishes at that width. Use `text-[1rem]`.
  (Had hidden the home-page race location line on desktop in production.)
- **Known stale tests**: `tests/e2e/guest.spec.ts` (3 tests) and `a11y.spec.ts` (1) fail on the
  pre-R37 baseline too — they still expect the old quiz-first home page; R25 moved the quiz behind
  a "Predict now" banner. Not a regression; needs rewriting. host/settings e2e: 6/6 pass.
- Still the user's: restore `recovery-companion-hack` Firestore rules via Console history; merge
  `worktree-build-v1` to main (I never do this); real venue/pricing data entry.

## NOT built — rest of the roadmap (docs/superpowers/plans/2026-09-27-topdown-roadmap.md)
1. **Host check-in scanner** (`/host/checkin`) — NOW UNBLOCKED (real bookings exist to scan as of
   B2). This is the natural next task.
2. **Lightweight audit log** for host-sensitive writes (score overrides, status changes) — low
   priority, PRD-inspired, not built.
3. **Delete button** for booking events — rules already allow `isHost()` delete; admin UI only
   supports toggling sales closed for now, by deliberate phase-1 scope decision.
4. `scripts/validate-calendar.py` cleanup — abandoned, safe to delete.
5. Third-party skill pack review (`.agents/skills/`, `.claude/`, `skills-lock.json` — 13 skills
   added via the user's own `npx skills add`, only checked for one duplicate so far).

## Two things only the user can decide
- **Payment**: mock-pay only (R23) by explicit choice, no timeline for a real gateway.
- **Sponsor names/logos** (Mahindra/Ramani, confirmed real via Instagram): placeholders only until
  the user confirms directly with the Karter Cup team.
- **Real venue/pricing data**: the booking admin UI is ready at `/host/bookings` whenever the user
  has real data to enter — nothing further needs building for this, just data entry.

## Rules/decisions files
rules.md now has R1-R35 (R35 = this session's booking-UI-with-stubs instruction), decisions.md has
every major architecture call plus this session's firebase-deploy incident, the guest/host code
boundary note, and the booking-with-stub-data decision. Read both before proposing anything —
several paths are already explicitly rejected and re-deriving them wastes time.
