# Rules (user-stated constraints, near-verbatim)

| # | Rule | Why | Enforced where |
|---|------|-----|----------------|
| R1 | Leaderboard "should only be available for us hosts" | Guests shouldn't see/copy others' picks; hosts run the reveal | Firestore rules + `/host` gate |
| R2 | No season-long table | "almost new guests every time and only a few repeating" | Scope: not built |
| R3 | Collect guest names (name entry or Google login) | Prizes for the quiz winner | Sign-in step, required name |
| R4 | Guests must be added to the WhatsApp community channel | Community growth | Confirmation/results CTA + CSV export |
| R5 | Quiz = last event's 5 questions (slowest pit, most overtakes, DNF driver, fastest pit, fastest lap) | Continuity with prior event | `src/config/event.ts` |
| R6 | Theme/facts must match the real Karter Cup (Chennai), not the Indonesian Kartar Cup | Real brand | Do not invent an "official" palette; use tokens block |
| R7 | Use Opus to plan; design skill + taste skill; Playwright for visual checks | User request | Process |
| R8 | Site title text "Kartar CUP" (user spelling) | User typed it | Copy |
| R9 | No emojis; one accent colour; no Inter; no pure black; no centered hero | design-taste-frontend skill | Design review |
| R10 | Host allowlist is exactly hariharankvasn@gmail.com (user's own Google account) | Only the user may reach the admin/settings page | `hosts/hariharankvasn@gmail.com` doc + host rules; emulator seed uses a separate test host |
| R11 | WhatsApp community link must be configurable on the settings page, not hard-coded | Link changes per community/event; user wants no redeploy | Settings page writes it to Firestore; guest CTA reads it (hidden when empty) |
| R12 | Race is admin-selectable; per-race themes for the 2026 remaining calendar and 2027, next race first, rest later | Reuse the site for every watch party | Calendar catalog + per-race theme files (Phase B/C) |
