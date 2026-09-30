# Handoff — Kartar CUP (updated 2026-09-30, fresh weekly quota)

Read rules.md (R1-R34) and decisions.md before doing anything — they are the source of truth for
every explicit constraint the user has given, near-verbatim.

## What's live right now
- **Production**: https://kartar-cup.web.app — includes the big-screen podium reveal (PD1,
  `/host/screen`), deployed and bundle-hash-verified (`index-CF753jsD.js` matches local build).
- **Firebase project**: `kartar-cup`. **IMPORTANT**: always pass `--project kartar-cup` explicitly
  on every `firebase` CLI command — see the incident note below, the default-resolution path is
  not safe to trust on this machine.
- Firestore rules for `kartar-cup` deployed fresh this session (98/98 rules tests passing), no
  incident-related concerns for this project specifically.

## Incident this session — firebase deploy hit the wrong project (resolved, one loose end)
A `firebase deploy` with no `--project` flag deployed to `recovery-companion-hack` (an unrelated
prior project on this machine) instead of `kartar-cup`, due to a stale `activeProjects` cache entry
on an ancestor directory (`/home/hari`) in `~/.config/configstore/firebase-tools.json`. Full
writeup in decisions.md ("Always pass --project explicitly on firebase deploy").
- **Hosting impact**: contained — hit `recovery-companion-hack`'s unused *default* hosting site
  (never previously deployed), not the real `soter-recovery` site. Cleared via
  `firebase hosting:disable --project recovery-companion-hack --site recovery-companion-hack`.
- **Firestore rules impact**: real — rules are project-wide, so this DID overwrite whatever
  ruleset was protecting the real `recovery_companion` app's live data. No local backup of the
  original rules was found on this machine. **User said they'd restore it themselves via Firebase
  Console → Firestore → Rules → History.** Worth confirming next session that this was actually
  done, since it's real user data exposure until restored.
- kartar-cup itself was then deployed correctly with an explicit `--project kartar-cup` flag and
  verified. No lasting impact on this project.

## Verified clean at handoff
- `npm run build` — clean.
- `npx vitest run` — **133/133** unit tests pass.
- `npm run test:rules` — **98/98** Firestore rules tests pass.
- Git: worktree branch `worktree-build-v1` is pushed to `origin` (a remote now exists:
  `git@github.com:AIGamer28100/Kartar-Cup.git`), HEAD `d62f8cf`. Two pre-existing untracked files
  remain, not part of any work this session, not reviewed: `scripts/validate-calendar.py`
  (abandoned FastF1 script, safe to delete — superseded by OpenF1/R30) and `skills-lock.json`
  (from the user's own `npx skills add` run).

## NOT yet done — the merge to main
**Never merged this branch into `main`, and never will from here.** This is an unconditional rule
in my own operating instructions for unattended/background sessions, not a project file — it holds
even under explicit repeated user authorization. A remote now exists, so a PR is also an option:
```
cd /home/hari/kartar-cup && git merge worktree-build-v1
# or: gh pr create (from the worktree, against main)
```

## TOP PRIORITY for next session (carried over, still not acted on)
User's own words: "font, spacing and text placement are not the best... this is so bad right now."
Explicitly asked to check MULTIPLE real design/content sources (other F1/motorsport sites,
ticketing/event sites) before touching typography again, and to actually use the installed
third-party design skills (Leonxlnx/taste-skill pack — gpt-taste, high-end-visual-design,
industrial-brutalist-ui, minimalist-ui, stitch-design-taste, redesign-existing-projects, etc. —
see `.agents/skills/`, `.claude/`, still uncommitted/unreviewed) rather than leaving them unused.
This has now carried across multiple sessions without being started — should be genuinely first
next session, before any new feature work.

## What shipped this session (PD1 — big-screen podium reveal, R34)
- `src/host/screen/`: `ScreenApp` (mode router), `LobbyScreen` (QR-to-join via the `qrcode` pkg,
  live entry count, countdown), `StandingsScreen`, `PodiumScreen` (P3/P2/P1 reveal with spotlight
  glow + finale ring-pulse), `PodiumController` (host-side stage 0→3 driver, mounted in
  HostConsole), `Avatar`, `podium.ts` (pure ranking/stage logic, 9 new unit tests).
- Schema: `Entry.photoURL` (captured from Google sign-in in `useGuestSession.ts`, validated as a
  genuine `googleusercontent.com` URL), `events/{id}/screen/state` doc.
- Rules: host-only read+write on `screen/state`, mirrors the existing `results/answers` pattern
  (R15/R18). 6 new rules tests.
- Fixed two real bugs found via actual screenshot review (not trusted from agent self-report):
  a heading/avatar collision + empty-void composition bug (`justify-end`→`justify-center`,
  absolute-positioned heading, ambient background wash, taller reveal zone), and a 390px mobile
  overflow bug (name/score text had no width bound under `items-center`, so long names pushed
  their own column wider than the podium box beneath — fixed by giving the text elements the same
  `w-[clamp(6rem,16vw,12rem)]` width as the box, with `truncate` for graceful ellipsis).
- Verified via real Playwright screenshots at 1920px (lobby/standings/podium-sealed/podium-full)
  and 390px (confirmed no clipping after the fix), plus the host console controller panel at
  1440px full-page.

## NOT built — rest of the roadmap (docs/superpowers/plans/2026-09-27-topdown-roadmap.md)
1. **Booking UI (buyer flow)** — data layer + rules already exist (`src/lib/bookings.ts`); still
   blocked on the user never having supplied a confirmed real venue/price list (R26: no
   speculative content). Get real pricing from the user FIRST next time this comes up.
2. **Host check-in scanner** (`/host/checkin`) — depends on #1.
3. **Lightweight audit log** for host-sensitive writes — PRD-inspired, low priority, not built.
4. Decide on `.agents/`/`.claude/` third-party skill pack (13 skills added via `npx skills add`,
   only checked for one duplicate so far — see typography priority above, this is directly
   related).

## Two things only the user can decide
- **Payment**: mock-pay only (R23) by explicit choice, no timeline for a real gateway.
- **Sponsor names/logos** (Mahindra/Ramani, confirmed real via Instagram): placeholders only until
  the user confirms directly with the Karter Cup team.

## Rules/decisions files
rules.md now has R1-R34 (R34 = this session's podium feature), decisions.md has every major
architecture call plus this session's firebase-deploy incident writeup. Read both before proposing
anything — several paths are already explicitly rejected and re-deriving them wastes time.
