# Handoff — Kartar CUP (written 2026-09-26 ~10:05 IST)

Race lights-out ~11:00 UTC = 16:30 IST (unverified). Session usage was 89%, resets 14:30 IST.
Worktree: /home/hari/kartar-cup/.claude/worktrees/build-v1 (branch worktree-build-v1, no remote). Nothing merged to main.

## Read first
docs/superpowers/plans/2026-09-26-kartar-cup-plan.md (contracts, rules design, tasks T1-T7), rules.md, decisions.md.

## State
| Task | Owner | Status |
|---|---|---|
| Spec, rules.md, decisions.md, plan | done | committed |
| T1 scaffold/tokens/firebase lib/components | sonnet agent | IN FLIGHT: package.json installed; types/firebase/db/components not yet written at 10:04 |
| T2 config/scoring/csv + tests | sonnet agent | IN FLIGHT: files written, tests not yet verified |
| T5 rules + emulator tests | sonnet agent | IN FLIGHT (started 10:05) |
| T3 guest UI, T4 host UI | not started | blocked on T1 (needs types.ts, db.ts, components) |
| T6 integration + deploy, T7 Playwright/a11y | not started | after T3/T4/T5 |

## Verified vs not
Verified: nothing yet (no test or build has been run by me). Do not trust agent reports without `npm test && npm run test:rules && npm run build`.

## Ordered next steps
1. Confirm T1 committed: `git log --oneline`, `npm run build`, tailwind major = 4, no tailwind.config.js.
2. Confirm T2 `npx vitest run src/lib src/config` green; T5 `npm run test:rules` green.
3. Launch T3 (guest) and T4 (host) in parallel as sonnet component-builder/implementer agents; pass plan section 4 blocks, design-taste-frontend rules, "plain commit message, no Co-Authored-By".
4. T6: seed script + emulator end-to-end + Firebase deploy (user must run `! firebase login` and supply project id).
5. T7: Playwright MCP screenshots at 390x844 and 1440x900, axe pass.
6. Strip any Co-Authored-By from history: eef6a1b and 3291f98 carry it (`git filter-branch --msg-filter` or rebase); verify `git log --format=%B | grep -i co-authored` is empty.

## Needed from user
WhatsApp community invite link (WHATSAPP_COMMUNITY_URL in src/config/event.ts); host Google email(s) for hosts/{email} docs; optional logo/colours in ~/kartar-cup/brand/ (tokens in src/styles/tokens.css); Firebase project id + firebase login.

## Rules to honor
No Co-Authored-By/attribution lines anywhere (global CLAUDE.md hard rule). Race-morning: verify grid + lights-out in src/config/event.ts.
