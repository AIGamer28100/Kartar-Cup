# Decisions and rejected alternatives

| Decision | Chosen | Rejected (why) |
|---|---|---|
| Collection backend | Firebase Auth + Firestore + Hosting, client-side scoring | Static/no-backend (no shared leaderboard); Google Form (least polished); Cloud Functions (needs Blaze, unnecessary for 5 questions) |
| Identity | Google sign-in OR name (+optional phone) | Anonymous only (can't award prize to a person) |
| WhatsApp | Invite link button + CSV export | Auto-add via API (WhatsApp offers no free community-add API) |
| Season table | Dropped (R2) | Carry-over points (guests change every race) |
| Tiebreak | Earliest submission; host override | Random draw (opaque); sudden-death question (needs another live judged answer) |
| Theme | Dark + Baku red fallback; swappable tokens | Guessing Karter Cup colours (couldn't verify; Instagram not scrapeable) |
| Search result "Kartar Cup" | Ignored Indonesian Karang Taruna tournaments | Using them as brand reference (wrong org) |
| Build priority (2026-09-27) | 1) Home page (H1, in flight): community/brand page, quiz demoted. 2) `/events` page: full upcoming-events listing. 3) Booking page: buyer flow off `/events`, using the existing B1 data/rules layer. Host scanner, big-screen podium, calendar validation, guest history/stats all come after | User: "priority, home page, then events page which takes to booking page" | Home page's own Upcoming Events section stays a short teaser linking to `/events`, not a full listing built twice |
