# Phase A — multi-event data model, auto open/close window, host settings page

Supersedes the single `event/current` model in the original plan. Read with rules.md (R10-R13) and the original plan section 3.

## Data model (Firestore)
- `settings/active` : `{ eventId: string }`. Read: public. Write: host.
- `events/{eventId}` : EventConfig. Read: public. Write: host.
  ```ts
  interface EventConfig {
    id: string; raceId: string /* calendar id or 'custom' */; name: string; subtitle: string;
    circuit: string | null; themeId: string;
    raceStartUtc: Timestamp;            // lights out
    raceDurationMin: number;            // normal, no red/yellow stretch; default 90
    opensAt: Timestamp;                 // default = raceStartUtc
    closesAt: Timestamp;                // default = raceStartUtc + 0.9 * raceDurationMin  (R13)
    override: 'none' | 'open' | 'closed';   // manual host control
    whatsappUrl: string;                // '' or https://chat.whatsapp.com/... or https://whatsapp.com/channel/...  (R11)
    teams: { id: string; label: string }[];                              // <= 12
    drivers: { id: string; label: string; teamId: string; grid: number }[]; // <= 24
    questions: { id: string; prompt: string; kind: 'team'|'driver'; hint?: string }[]; // <= 8
    questionIds: string[];              // mirror of questions[].id, used by rules
    winnerRevealed: boolean; tiebreakOverride: string | null;
    createdAt: Timestamp; updatedAt: Timestamp;
  }
  ```
- `events/{eventId}/results/answers` : `{ answers: Record<qid,string[]>, source: string, updatedAt }`. Read: host, or `winnerRevealed==true`. Write: host.
- `events/{eventId}/entries/{uid}` : as today (uid, name, email?, phone?, provider, answers, submittedAt, createdAt).
- `hosts/{email}` unchanged. Only `hariharankvasn@gmail.com` in production (R10); emulator tests use a fake host.

## Derived status (client, never stored)
`scheduled` (now < opensAt and override!='open') / `open` / `closed` (now >= closesAt or override=='closed') / `scored` (winnerRevealed). A `useEventStatus(config)` hook ticks each second (or schedules on the next boundary).

## Rules
- `acceptingEntries(eventId)`: `ev.override != 'closed' && request.time < ev.closesAt && (ev.override == 'open' || request.time >= ev.opensAt)` AND `get(settings/active).data.eventId == eventId`.
- Entry create/update: existing shape checks, plus `d.answers.keys().toSet().hasOnly(ev.questionIds.toSet())` and `hasAll`, each answer a string <= 40.
- EventConfig write validation (host only, still validated): whatsappUrl allowlist, list size caps, string length caps, `closesAt > opensAt`.
- All existing rules tests get ported to the new paths; add: outside window denied (before opensAt, after closesAt), override closed/open, non-active event denied, questionIds mismatch denied, non-host cannot write settings/events, guest cannot read results before reveal.

## Tasks (sequential A1 then parallel A2/A3)
- **A1 data layer**: types.ts, db.ts (keep existing function names working as wrappers where possible so guest/host compile; add new ones), firestore.rules, tests/rules, seed script, `src/config/event.ts` gains `buildDefaultEvent(race: RaceInfo): EventConfig` (drivers/teams template from the current grid data; 5 default questions; closesAt per R13), Playwright specs updated. Everything green.
- **A2 settings page** (`src/host/settings/**`, route `/host/settings`): pick race from `src/config/calendar` (default `nextRace()`), or custom; edit name, subtitle, dates (race start local time + IST/UTC shown), duration, opens/closes preview, override buttons (open now / close now / extend by N min), WhatsApp link (validated, with Test link button), grid editor (22 rows: reorder, driver label, team), teams, questions (add/remove/reorder up to 8, kind), "Set as live event" (writes settings/active), "Reset entries" is NOT included.
- **A3 guest updates** (`src/guest/**`): countdown to opensAt ("Picks open at lights-out"), live window with time left to closesAt, closed state, dynamic questions from the active event, WhatsApp CTA from `event.whatsappUrl`, fix hero copy (no "before lights go out"), use event name/subtitle. Guest never reads other entries.
- **Verification** (me): build, vitest, test:rules, playwright, screenshots reviewed, security-auditor pass on rules.
