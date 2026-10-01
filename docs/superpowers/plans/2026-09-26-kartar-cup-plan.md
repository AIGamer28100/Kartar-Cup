# Kartar CUP — Implementation Plan (2026-09-26, ~6h to lights-out)

Inputs: `docs/superpowers/specs/2026-09-26-kartar-cup-design.md`, `rules.md` (R1–R9), `decisions.md`. Env verified: Node 22, npm 10, Java 25 (Firestore emulator OK). No `brand/` dir yet → fallback palette.

## 0. Global locks (every agent obeys)
- **Tailwind v4 only**, pinned exact (`tailwindcss@4.x`, `@tailwindcss/vite`). CSS entry uses `@import "tailwindcss";` + `@theme {}`. NO `tailwind.config.js`, NO `@tailwind base/components/utilities`, NO `postcss.config`. Verify: `node -p "require('tailwindcss/package.json').version"` starts with `4.`.
- Answer values stored as stable **ids** (`'russell'`, `'mercedes'`), never display names.
- No emojis, no Inter, no pure black, one accent, `min-h-[100dvh]`, Geist/Geist Mono via `@fontsource-variable/geist` + `@fontsource-variable/geist-mono` (self-hosted, works on bad Wi-Fi). Phosphor icons `weight="regular"` everywhere.
- Only T1 edits `package.json`, `vite.config.ts`, `tsconfig*`. Other tasks request deps from the coordinator instead of installing them.
- Routing: no router lib. `App.tsx` switches on `location.pathname.startsWith('/host')`; Hosting rewrites `**` → `/index.html`.

## 1. File tree
```
package.json  vite.config.ts  tsconfig.json  tsconfig.app.json  tsconfig.node.json
index.html  .env.example  .firebaserc  firebase.json  firestore.rules  firestore.indexes.json
vitest.config.ts            # unit (node env)
vitest.rules.config.ts      # rules tests only, include tests/rules/**
playwright.config.ts
scripts/seed-emulator.mjs   # REST seed with "Authorization: Bearer owner"
src/main.tsx  src/App.tsx
src/styles/tokens.css       # ONE @theme block: palette + fonts (swap point for brand/)
src/styles/index.css        # @import "tailwindcss"; @import "./tokens.css"; base layer
src/config/event.ts         # all quiz/grid content + LIGHTS_OUT_UTC + WHATSAPP_COMMUNITY_URL
src/config/event.test.ts
src/lib/types.ts            # contracts below (verbatim)
src/lib/firebase.ts         # init, emulator connect, auth helpers
src/lib/db.ts               # typed Firestore helpers (signatures below)
src/lib/scoring.ts  src/lib/scoring.test.ts
src/lib/csv.ts      src/lib/csv.test.ts
src/lib/useCountdown.ts  src/lib/inAppBrowser.ts
src/components/{Button,StatusDot,Countdown,Skeleton,Divider}.tsx
src/guest/{GuestApp,Hero,SignIn,Quiz,QuestionPicker,Confirmation,OwnScore,WhatsAppCta}.tsx
src/guest/{useGuestSession.ts,draft.ts}
src/host/{HostApp,HostGate,StatusPanel,ResultsForm,Leaderboard,RevealWinner}.tsx
src/host/useHostData.ts
tests/rules/firestore.rules.test.ts
tests/e2e/{guest.spec.ts,host.spec.ts,a11y.spec.ts}
```

## 2. Contracts
`src/lib/types.ts`:
```ts
export type QuestionId = 'q1'|'q2'|'q3'|'q4'|'q5';
export const QUESTION_IDS: QuestionId[] = ['q1','q2','q3','q4','q5'];
export type Answers = Record<QuestionId, string>;          // option id per question
export type Results = Record<QuestionId, string[]>;        // multiple accepted ids; [] = voided
export type EventStatus = 'open'|'locked'|'scored';
export type Provider = 'google'|'anonymous';
export interface EventDoc { status: EventStatus; lightsOutUtc: Timestamp; winnerRevealed: boolean; tiebreakOverride: string|null }
export interface ResultsDoc { answers: Results; source: string; updatedAt: Timestamp }
export interface Entry { uid: string; name: string; email?: string; phone?: string; provider: Provider;
  answers: Answers; submittedAt: Timestamp; createdAt: Timestamp }
export interface ScorableEntry { uid: string; name: string; answers: Answers; submittedAtMs: number }
export interface RankedRow extends ScorableEntry { score: number; ticks: Record<QuestionId, boolean>;
  rank: number; tiedOnScore: boolean }
export interface Option { id: string; label: string; sub?: string }   // sub = team / grid slot
export interface Question { id: QuestionId; prompt: string; kind: 'team'|'driver'; hint?: string }
```
`src/lib/scoring.ts` (pure, no Firebase imports):
```ts
export function normalize(id: string): string                 // trim + lowercase
export function scoreEntry(a: Answers, r: Results): { score: number; ticks: Record<QuestionId, boolean> }
export function rankEntries(entries: ScorableEntry[], r: Results, override?: string|null): RankedRow[]
// sort: score desc, submittedAtMs asc, uid asc (deterministic). rank = 1-based position.
// tiedOnScore = another entry has the same score. override: honored ONLY if that uid is in the
// top-score group -> moved to index 0, ranks recomputed; otherwise ignored.
export function winner(rows: RankedRow[]): RankedRow | null
```
`src/config/event.ts` exports: `LIGHTS_OUT_UTC = '2026-09-26T11:00:00Z'`, `WHATSAPP_COMMUNITY_URL = ''` (host fills; CTA hidden if empty), `SITE_TITLE = 'Kartar CUP'`, `TEAMS: Option[]` (11), `DRIVERS: Option[]` (22, grid order from spec, `sub` = team + "P14" etc.), `QUESTIONS: Question[]` (R5 order), `optionsFor(q: Question): Option[]`, `validateEventConfig(): string[]` (empty = valid: 5 questions, unique ids, 11 teams, 22 drivers, every driver's team in TEAMS, LIGHTS_OUT_UTC parses).

`src/lib/firebase.ts`: `app, auth, db`; connects emulators when `import.meta.env.VITE_USE_EMULATORS==='true'`; `signInGoogle()` (popup), `signInGuest()` (anonymous), `signOutUser()`; in emulator mode only, `window.__e2eLogin(email)` via `GoogleAuthProvider.credential('{"sub":..,"email":..,"email_verified":true}')`.
`src/lib/db.ts`:
```ts
watchEvent(cb: (e: EventDoc|null) => void): Unsubscribe
watchOwnEntry(uid: string, cb: (e: Entry|null, pending: boolean) => void): Unsubscribe  // includeMetadataChanges
submitEntry(input: {uid; name; email?; phone?; provider; answers}, isFirst: boolean): Promise<void>
  // create: setDoc with submittedAt=createdAt=serverTimestamp(); update: setDoc(merge) WITHOUT createdAt
watchResults(cb: (r: ResultsDoc|null) => void, onErr?): Unsubscribe  // guests call only when status==='scored'
watchEntries(cb: (e: Entry[]) => void): Unsubscribe                   // host; snapshot serverTimestamps:'estimate'
isHost(email: string): Promise<boolean>                               // getDoc(hosts/{email.toLowerCase()})
initEvent(lightsOutIso: string): Promise<void>                        // host: create event/current if missing
setEventStatus(s: EventStatus): Promise<void>;  setLightsOut(iso: string): Promise<void>
saveResults(r: Results, source: string): Promise<void>
revealWinner(overrideUid: string|null): Promise<void>                 // sets status 'scored', winnerRevealed true
```
`src/lib/csv.ts`: `toCsv(rows: (RankedRow & {email?; phone?; submittedAtIso: string})[]): string` columns `rank,name,email,phone,score,submittedAt`, RFC4180 quoting, and prefixes cells starting with `= + - @` with `'` (CSV injection).

## 3. Firestore rules design
Docs: `event/current` (public status, NO results), `event/results` (results + source), `entries/{uid}`, `hosts/{email}` (doc id = lowercase email; created manually in the console, not writable from any client).
```
function signedIn() { return request.auth != null; }
function isHost() { return signedIn() && request.auth.token.email_verified == true
  && request.auth.token.firebase.sign_in_provider == 'google.com'
  && exists(/databases/$(database)/documents/hosts/$(request.auth.token.email.lower())); }
function ev() { return get(/databases/$(database)/documents/event/current).data; }
function acceptingEntries() { return ev().status == 'open' && request.time < ev().lightsOutUtc; }
function validEntry(uid) { let d = request.resource.data; return
  d.keys().hasOnly(['uid','name','email','phone','provider','answers','submittedAt','createdAt'])
  && d.keys().hasAll(['uid','name','provider','answers','submittedAt','createdAt'])
  && d.uid == uid && d.name is string && d.name.size() >= 2 && d.name.size() <= 60
  && (!('phone' in d) || (d.phone is string && d.phone.matches('^[+0-9 ]{7,16}$')))
  && (!('email' in d) || d.email == request.auth.token.email)
  && d.provider in ['google','anonymous']
  && d.answers.keys().hasOnly(['q1','q2','q3','q4','q5']) && d.answers.keys().hasAll(['q1','q2','q3','q4','q5'])
  && d.answers.q1 is string && d.answers.q1.size() <= 40   /* repeat q2..q5 */
  && d.submittedAt == request.time; }
match /event/current { allow read: if true; allow write: if isHost(); }
match /event/results { allow read: if isHost() || ev().status == 'scored'; allow write: if isHost(); }
match /entries/{uid} {
  allow get: if (signedIn() && request.auth.uid == uid) || isHost();
  allow list, delete: if isHost();
  allow create: if signedIn() && request.auth.uid == uid && acceptingEntries() && validEntry(uid)
                && request.resource.data.createdAt == request.time;
  allow update: if signedIn() && request.auth.uid == uid && acceptingEntries() && validEntry(uid)
                && request.resource.data.createdAt == resource.data.createdAt; }
match /hosts/{email} { allow get: if signedIn() && request.auth.token.email.lower() == email; allow write: if false; }
```
Flow: host enters results (status stays `locked`, guests are still denied), the leaderboard scores on the host screen, and "Reveal winner" sets `status='scored'`, which unlocks each guest's own-score screen (R1 holds: guests only ever see their own entry).

Rules tests (`tests/rules/firestore.rules.test.ts`, `@firebase/rules-unit-testing`, seed with `withSecurityRulesDisabled`; host ctx = `authenticatedContext('h1',{email:'host@x.com',email_verified:true,firebase:{sign_in_provider:'google.com'}})`):
1. anon guest creates own entry (open, future lightsOut, serverTimestamp) — succeeds
2. create with another uid — denied
3. create when status `locked` — denied
4. create when `lightsOutUtc` in the past but status `open` — denied (server-clock lock)
5. malformed: missing q5 / extra answer key / extra field `score` / name 61 chars / bad phone / client-supplied `submittedAt` — each denied
6. `email` field not matching token email — denied
7. owner updates answers while open — succeeds; update changing `createdAt` — denied
8. guest get other's entry — denied; guest list `entries` — denied; unauth get — denied
9. guest reads `event/current` — succeeds; guest writes it — denied
10. guest reads `event/results` while `locked` — denied; after `scored` — succeeds
11. host lists entries, writes `event/current` + `event/results` — succeeds
12. Google user not in `hosts/` — denied host ops; allowlisted email with `email_verified:false` — denied; anonymous user — denied
13. any client write to `hosts/*` — denied (host included)
14. guest deletes own entry — denied

## 4. Tasks (file ownership is exclusive; a task touches nothing outside its list)
Order: **T1 → {T2 can start writing at once; runs its tests after T1 lands} → {T3, T4, T5 parallel} → T6 → T7.**

**T1 Scaffold + tokens + Firebase lib + primitives** (sonnet, ~40m)
Owns: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `.env.example`, `.firebaserc`, `firebase.json`, `vitest.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles/**`, `src/lib/{types,firebase,db,useCountdown,inAppBrowser}.ts`, `src/components/**`, placeholder `firestore.rules` (deny all), placeholder `src/guest/GuestApp.tsx` + `src/host/HostApp.tsx` (default-export stubs; ownership passes to T3/T4).
Install everything up front: react@18, react-dom@18, firebase, framer-motion, @phosphor-icons/react, @fontsource-variable/geist(-mono), tailwindcss@4 + @tailwindcss/vite; dev: vitest, @firebase/rules-unit-testing, firebase-tools, @playwright/test, @axe-core/playwright, typescript. Scripts: `dev`, `build` (`tsc -b && vite build`), `test` (`vitest run`), `test:rules` (`firebase emulators:exec --only firestore "vitest run -c vitest.rules.config.ts"`), `emu` (`firebase emulators:start --only auth,firestore`), `seed` (`node scripts/seed-emulator.mjs`), `e2e` (`playwright test`).
`firebase.json`: hosting `dist`, rewrite `**`→`/index.html`, long cache on `/assets/**`, firestore rules/indexes paths, emulators auth 9099, firestore 8080, hosting 5000, ui off.
`tokens.css` (fallback, swappable): `@theme { --color-base: hsl(220 8% 9%); --color-raised: hsl(220 7% 13%); --color-line: hsl(220 6% 22%); --color-ink: hsl(40 10% 94%); --color-muted: hsl(220 6% 64%); --color-accent: hsl(356 72% 52%); --color-accent-ink: hsl(0 0% 100%); --font-sans: "Geist Variable", system-ui, sans-serif; --font-mono: "Geist Mono Variable", ui-monospace, monospace; }`. `StatusDot` breathes (opacity/scale only, respects `prefers-reduced-motion`). `Countdown` uses `font-mono tabular-nums`.
Verify: `npm run build && node -p "require('tailwindcss/package.json').version" | grep '^4\.' && ! test -e tailwind.config.js`

**T2 Config + scoring + CSV + unit tests** (haiku, ~40m)
Owns: `src/config/event.ts`, `src/config/event.test.ts`, `src/lib/scoring.ts`, `src/lib/scoring.test.ts`, `src/lib/csv.ts`, `src/lib/csv.test.ts`.
Test cases: all-correct = 5; multi-answer (`q2:['norris','piastri']`) credits both; case/whitespace-insensitive; voided `[]` gives 0 to everyone; same score orders by earlier `submittedAtMs`; equal ms falls back to uid; override inside the top group moves to #1; override outside the top group is ignored; empty entries gives `winner()===null`; `validateEventConfig()` returns `[]`; each driver's team is in TEAMS; CSV quoting of `,"\n` and the `=cmd` injection prefix.
Verify: `npx vitest run src/lib src/config`

**T3 Guest UI** (sonnet + design-taste skill, ~90m)
Owns: `src/guest/**`.
State machine in `GuestApp`: loading skeleton → Hero (asymmetric split, left-aligned, "Kartar CUP", countdown, StatusDot) → SignIn (name ≥2 chars required, R3; optional phone with consent line "We'll add you to The Karter Cup WhatsApp community"; Google button hidden when `inAppBrowser()` is true) → Quiz (5 steps, searchable picker, driver sub = team·grid slot, keyboard operable, answers auto-saved in `draft.ts` localStorage) → Confirmation ("Picks locked in" only when `pending===false`, otherwise "Transmitting to race control…"; edit allowed while open; WhatsAppCta) → Locked (status≠open or countdown hit 0: read-only picks) → OwnScore (status `scored`: own score + tick strip via `scoreEntry`, WhatsAppCta). Error state for permission-denied at submit: "Pit lane closed — picks arrived after lights-out."
Verify: `npm run build` plus manual smoke on `VITE_USE_EMULATORS=true npm run dev` at 390px width.

**T4 Host UI** (sonnet + design-taste skill, ~90m, projector-first large type)
Owns: `src/host/**`.
`HostGate`: Google sign-in → `isHost(email)` → otherwise "Not on the marshal list." `StatusPanel`: live entry count, Initialize event (if doc missing), Open/Lock toggle, edit lights-out (for start delays). `ResultsForm`: per question, multi-select of accepted ids + source note → `saveResults`. `Leaderboard`: `rankEntries` over `watchEntries`, columns rank / name / score (mono) / 5-tick strip; tied top rows are clickable to set the override (confirm dialog). `RevealWinner`: staggered spring reveal, calls `revealWinner(override)`. CSV button uses `toCsv` + Blob download.
Verify: `npm run build` plus manual smoke with emulator host login.

**T5 Rules + emulator tests** (opus, ~60m; a leak here exposes guest PII)
Owns: `firestore.rules`, `firestore.indexes.json` (empty), `vitest.rules.config.ts`, `tests/rules/**`. Implements §3 exactly, with all 14 cases.
Verify: `npm run test:rules`

**T6 Integration + deploy** (sonnet, ~45m)
Owns: `scripts/**`, `.env.local` (not committed), and may edit `src/App.tsx` and `src/lib/db.ts` for wiring fixes only.
Tasks: seed script (event/current open with lights-out = now+2h, a host doc, 3 sample entries); full emulator flow guest submit → host lock → results → reveal → guest sees own score; create the Firebase project/web app; add `hosts/{email}` docs in the console; confirm authorized domains; `firebase deploy --only firestore:rules,hosting`.
Verify: `npm test && npm run test:rules && npm run build && npx firebase deploy --only firestore:rules,hosting`, then open `https://<project>.web.app` on a real phone.

**T7 Playwright visual + a11y pass** (sonnet, ~45m)
Owns: `playwright.config.ts`, `tests/e2e/**`. Fixes found here go back to the T3/T4 files, applied sequentially.
Projects: guest 390x844, host 1440x900; `webServer` = emulators + seeded `vite dev` with `VITE_USE_EMULATORS=true`; host login via `window.__e2eLogin('host@x.com')`. Screenshot each guest state and host gate/leaderboard/reveal. axe: no serious or critical violations (contrast of accent on base, muted text ≥4.5:1). Keyboard: complete the quiz with Tab/Enter/arrow keys only.
Verify: `npx playwright test --reporter=line` (screenshots in `test-results/`, reviewed by eye against R9).

## 5. Risks → mitigation
1. **Tailwind v3/v4 syntax mix**: pin v4 in T1, state the §0 lock in every agent prompt; T1's verify step fails if `tailwind.config.js` exists.
2. **Google sign-in authorized domains / webviews**: serve only from `<project>.web.app` or `<project>.firebaseapp.com`; use popup, not redirect. WhatsApp/Instagram in-app browsers block Google OAuth, so `inAppBrowser()` hides the Google button and the name path (anonymous auth) is the primary flow.
3. **Lock-time race (phone clock vs `event.status`)**: the server decides. Rules require `status=='open' && request.time < lightsOutUtc`. The UI countdown is cosmetic; the host can move `lightsOutUtc` if the start is delayed.
4. **Offline / poor venue Wi-Fi**: small bundle, self-hosted fonts, answers drafted in localStorage. Confirmation shows "locked in" only after the server acknowledges (`hasPendingWrites===false`). Host keeps a phone hotspot as fallback. Writes arriving after lights-out are rejected by rules and shown as the "Pit lane closed" error.
5. **Unverified `LIGHTS_OUT_UTC` / grid**: check on race morning; change `src/config/event.ts` and run `npm test`, or update lights-out live from the host StatusPanel without redeploying.
