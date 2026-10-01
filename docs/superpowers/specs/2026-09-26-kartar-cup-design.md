# Kartar CUP — Baku Watch Party Prediction Game (design)

Date: 2026-09-26. Event: 2026 F1 Azerbaijan GP, Baku, Saturday 26 Sep (race ~11:00 UTC / 16:30 IST, single constant `LIGHTS_OUT_UTC`, unverified).
Host brand: The Karter Cup (Chennai motorsport community: karting, sim racing, F1 watch parties; @thekartercup). Site title text: "Kartar CUP" (user spelling).

## Goal

Guests at the watch party scan a QR / open a link on their phone, identify themselves (so hosts can hand out a prize and add them to the WhatsApp community), answer 5 predictions, and get locked at lights-out. Hosts (only) see a live leaderboard, enter the real results after the flag, and reveal the winner.

## Stack

Vite + React 18 + TypeScript + Tailwind (check installed major before using syntax) + framer-motion + @phosphor-icons/react. Firebase: Auth (Google + anonymous), Firestore, Hosting. No Cloud Functions (no Blaze plan needed): scoring runs client-side in the host view.

## Surfaces

1. Guest `/` : hero, countdown to lights-out, sign-in (Google button OR full name + optional mobile w/ consent line), quiz (5 questions), locked/confirmation screen with WhatsApp community CTA, post-results own-score screen.
2. Host `/host` : gated by Google sign-in and `hosts/{uid}`-style allowlist by email. Live submission count, Open/Lock toggle, results entry form (+ source note), auto-scored leaderboard (rank, name, score, per-question tick strip), "Reveal winner" moment, CSV export (name, email, phone, score, submittedAt).

## Quiz (from previous event)

Q1 Constructor with the SLOWEST pit stop (team picker, 11 teams)
Q2 Driver with the MOST overtakes (driver picker, 22)
Q3 Driver who will DNF (driver picker, 22)
Q4 Constructor with the FASTEST pit stop (team picker)
Q5 Driver with the FASTEST LAP of the race (driver picker)
Scoring: 1 point per correct answer. Host results form allows multiple accepted answers per question (ties in data). Tiebreak: earliest `submittedAt`; host can override by clicking a tied row.
All quiz content lives in one config file `src/config/event.ts` so the next race is a data swap.

## Grid data (qualifying + penalties, from motorsport.com; verify on race morning)

P1 Russell (Mercedes), P2 Leclerc (Ferrari), P3 Piastri (McLaren), P4 Hadjar (Red Bull), P5 Norris (McLaren), P6 Hamilton (Ferrari), P7 Gasly (Alpine), P8 Verstappen (Red Bull), P9 Colapinto (Alpine), P10 Bearman (Haas), P11 Lawson (Racing Bulls), P12 Albon (Williams), P13 Ocon (Haas), P14 Sainz (Williams, 5-place grid penalty applied), P15 Lindblad (Racing Bulls), P16 Antonelli (Mercedes), P17 Bortoleto (Audi), P18 Hulkenberg (Audi), P19 Perez (Cadillac), P20 Bottas (Cadillac), P21 Alonso (Aston Martin, back of grid, PU penalty), P22 Stroll (Aston Martin, back of grid, PU penalty).
Teams (11): Mercedes, Ferrari, McLaren, Red Bull, Alpine, Haas, Racing Bulls, Williams, Audi, Cadillac, Aston Martin.
Trivia: championship leader Antonelli +81 over Russell; Baku 10th anniversary; first-ever Saturday race here.

## Data model (Firestore)

- `event/current` : { status: 'open'|'locked'|'scored', lightsOutUtc, results?: { q1..q5: string[] }, resultsSource?: string, winnerRevealed?: boolean, tiebreakOverride?: uid }
- `entries/{uid}` : { uid, name, email?, phone?, provider, answers: {q1..q5: string}, submittedAt, createdAt }
- `hosts/{email}` : {} (allowlist)
Rules: guest may create/update ONLY own `entries/{uid}` while `event/current.status=='open'` and answers well-formed, never read others. Guests may read `event/current` (results only when status=='scored', enforced by keeping results in `event/results` readable only when scored). Hosts (email in `hosts/`) read/write everything. Emulator rules tests required.

## Look and feel

Dark charcoal base (not pure black), ONE accent: signal red (Baku red) at saturation <80%. Geist + Geist Mono (mono for all numerals, timing-tower style). Anti-card: dividers/negative space, asymmetric hero (left-aligned, split). Phosphor icons at one strokeWidth, no emojis anywhere. Motion: CSS/Framer, transform+opacity only, spring physics, staggered reveals, live-timing "breathing" status dot, countdown. `min-h-[100dvh]`. Mobile-first: guests are on phones; host view is projector-first (large type). States: loading skeletons, empty, error, locked. Cheeky race-control-radio copy, concrete verbs (no "Elevate/Seamless/Unleash").
Brand tokens in ONE CSS block (`src/styles/tokens.css`) so a logo/palette from `brand/` can be swapped in. Fallback palette used until then.

## WhatsApp

No free API adds users to a community. Show invite link button (`WHATSAPP_COMMUNITY_URL` constant, host to supply) on confirmation and results screens; host CSV export of name+phone for manual add/broadcast. Phone number optional with consent text.

## Testing / verification

Vitest for scoring + tiebreak + config validation; Firestore rules tests via emulator; Playwright screenshots at 390x844 and 1440x900 for guest + host; build must pass; a11y contrast/keyboard pass.
