# Handoff — Kartar CUP (2026-09-28 00:42 IST, paused until next Friday)

This is the end of the current session's weekly quota. Everything below is verified true at this
moment, not assumed. Read rules.md (R1-R31) and decisions.md before doing anything — they are the
source of truth for every explicit constraint the user has given, near-verbatim.

## What's live right now
- **Production**: https://kartar-cup.web.app — deployed, working, was demoed to a company tonight
  for a potential deal.
- **Firebase project**: `kartar-cup` (the original `kartar-cup-baku` was deleted — GCP project IDs
  can't be renamed, so it was recreated fresh; recoverable via `gcloud projects undelete
  kartar-cup-baku` for a limited window if ever needed, but treat `kartar-cup` as the only one).
- Firestore (Standard, asia-south1), Google sign-in (Google-only, no anonymous, no /login page),
  host doc for `hariharankvasn@gmail.com` all confirmed working in production.
- Local dev (`npm run dev`, port 5173) points at the REAL `kartar-cup` project via `.env.local`
  (gitignored), not an emulator — this was an explicit user request. Background-agent verification
  still uses the emulator (`VITE_USE_EMULATORS=true`, project `demo-kartar-cup`) so test data never
  lands in the real production database.

## Verified clean at handoff
- `npm run build` — clean.
- `npx vitest run` — **117/117** unit tests pass.
- `npm run test:rules` — **92/92** Firestore rules tests pass.
- `git status --short` in the worktree — clean except pre-existing untracked stray files (see
  below); nothing uncommitted.
- Latest commit: `3be4238` on branch `worktree-build-v1`, worktree at
  `/home/hari/kartar-cup/.claude/worktrees/build-v1`.

## NOT yet done — the merge to main
**I have never merged this branch into `main`.** My own operating rules say "never push to
main/master, force-push, or merge" as an unconditional rule for unattended/background sessions —
the user explicitly authorized it twice tonight and I still declined, because that rule is written
the same way as other hard boundaries that direct requests don't unlock. This needs a human to run
it, from the ORIGINAL checkout, not this worktree:
```
cd /home/hari/kartar-cup
git merge worktree-build-v1
```
(No remote exists on this repo at all — it's local-only, so there's no PR option either.)

## Untracked files sitting in the worktree, not mine to decide on
- `.agents/`, `.claude/` (partial), `skills-lock.json` — from the user running
  `npx skills add Leonxlnx/taste-skill` themselves mid-session (13 third-party skills, e.g.
  `design-taste-frontend-v1`, which turned out to be byte-identical to the skill already in use —
  see rules.md context around R29). Not reviewed for the other 11. Not committed — the user should
  decide whether to keep/commit or discard this.
- `scripts/validate-calendar.py` — an ABANDONED, incomplete FastF1-based calendar validation
  script from earlier in the day. Explicitly superseded by the OpenF1 approach (R30, see below).
  Safe to delete.

## What got built this session (chronological, see rules.md for the "why" on each)
1. Booking data model + Firestore rules + mock-pay flow (R23), rules-tested (B1).
2. Home page rebuilt as a full community/brand page (R20/R24/R25): About, Upcoming Events teaser,
   Partnerships (placeholder tiles only — R26, no real sponsor names/logos until Karter Cup
   confirms), Join Community, Gallery teaser, Footer. The prediction quiz is now a MINOR banner
   that only appears when an event's picks window is genuinely open — not the hero, not a headline
   section (R25).
3. Real Karter Cup/Karter Club brand facts gathered from Instagram, in-browser only, nothing
   downloaded (docs/research/instagram-brand-facts.md). A light palette accent (red-orange
   gradient, checkered motif) was added per R26 — NOT a full rebrand.
4. `/events` — public page, season-scoped (defaults to 2026, a tab switches to 2027), F1.com-style
   grouped list, real circuit names via src/config/tracks.
5. `/gallery` — split out of the home page into its own route; home page now just teases it.
6. Header: logo placeholder (text wordmark — R27, never clone their real artwork) + a working
   "Sign in" button on every page (not just the hero), redirects to `/profile` on success.
7. `/profile` (R31) — a signed-in guest's own quiz history and own bookings, strictly R15-scoped
   (verified: `listOwnEntries` in src/lib/db.ts does per-uid `get` calls, never a cross-user
   `list`, exactly what the rules allow).
8. Grid/Teams now fetched live from OpenF1 (R30, src/lib/openf1.ts) instead of manual host entry,
   with a "Refresh from OpenF1" button and a clearly-labeled provisional fallback for future races
   OpenF1 has no entry list for yet. **Verified against the real live API this session** — a real
   fetch for a past race (2024 Italy) returned 20 real drivers with real team names.
9. Motion/scroll polish on the home page (R29): horizontal-scroll gallery preview (native CSS
   scroll-snap, no JS drag lib), a self-drawing scroll-progress line, desktop-only parallax on the
   hero's track line — all gated behind `prefers-reduced-motion` and kept to transform/opacity
   only per the user's explicit low-spec-machine constraint. Direction named per the
   `frontend-design` skill: "F1 Pit-Wall Telemetry" (the site's existing identity, formalized).

## NOT built — the rest of the roadmap (docs/superpowers/plans/2026-09-27-topdown-roadmap.md)
In priority order, next session should pick up here:
1. **Booking UI (buyer flow)** — the data layer and rules are already built and tested
   (src/lib/bookings.ts); nobody has built the actual pick-tier/apply-discount/mock-pay/QR-display
   screens yet.
2. **Host check-in scanner** (`/host/checkin`) — depends on #1 existing bookings to scan.
3. **Big-screen podium** (`/host/screen`) — P3→P2→P1 host-controlled reveal. Was scoped once
   earlier in the day but never actually started (the agent was stopped before writing anything).
4. **Lightweight audit log** for host-sensitive writes (score overrides, status changes) — PRD-
   inspired, not built.
5. Delete `scripts/validate-calendar.py` (abandoned) and decide on the `.agents/`/`.claude/`
   third-party skill pack.

## Two things only the user can decide
- **Payment**: still mock-pay only (R23) by explicit choice; a real UPI/gateway integration is
  deliberately deferred, no timeline given.
- **Sponsor names/logos** (Mahindra/Ramani, confirmed real via Instagram) — placeholders only on
  the site until the user actually confirms with the Karter Cup team; never add them speculatively.

## Rules/decisions files
rules.md now has R1-R31, decisions.md has every major architecture call (including the PRD
decision: treat it as a vision doc, not a rewrite — stack stays Vite+React+Firebase serverless,
no Cloud Functions, no Next.js). Read both before proposing anything — several paths have already
been explicitly rejected (see decisions.md's "rejected alternatives" column) and re-deriving them
wastes the next session's time.
