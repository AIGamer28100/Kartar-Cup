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
