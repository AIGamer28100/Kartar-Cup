# Kartar Cup

Leisure go-karting league and F1 watch-party community (Chennai and Coimbatore): live race-state
home page, prediction quiz, cup standings, ticketed events with door check-in, and a host console.

Stack: Vite, React 18, TypeScript (strict), Tailwind v4, framer-motion, react-router 7, Firebase
(Auth, Firestore, Hosting). There is **no backend server and no Cloud Functions**: all rules live in
`firestore.rules`. The one external piece is a tiny Cloudflare Worker that hides the Google Places key.

```
src/guest      public site (home, events, cup, quiz, tickets, profile)
src/host       host console (settings, bookings, check-in, results, big screen)
src/lib        Firebase access, pricing, scoring, race state, place search
firestore.rules  every access rule (tests in tests/rules)
worker/places-proxy  Cloudflare Worker: Google Places proxy (see below)
rules.md, decisions.md, TASKS.md  product constraints and history, read these before changing behaviour
```

## 1. Run it locally

```bash
npm ci
cp .env.example .env.local        # fill in the values below
npm run dev                       # http://localhost:5173
```

| Variable | What it is |
| --- | --- |
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Firebase console, Project settings, "Your apps", Web app config. Without `VITE_FIREBASE_API_KEY` the site shows a "not configured" page instead of loading. |
| `VITE_PLACES_PROXY_URL` | URL of your deployed Places Worker (section 4). Leave empty and venue search shows "not configured"; everything else works. |
| `VITE_USE_EMULATORS=true` | Optional: use the local Firebase emulators with a demo key. |

Firebase web config values are public by design (security comes from `firestore.rules`). The Google
Places key is **not** one of them and never goes in `.env*` files.

Checks: `npm run build` (type-check + bundle), `npm test` (unit tests), rules tests need the emulator:

```bash
npx firebase emulators:exec --only firestore --project demo-kartar \
  "npx vitest run --config vitest.rules.config.ts"
```

## 2. Who can do what (roles)

* **Guests** sign in with Google, buy tickets, play the quiz, see only their own bookings.
* **Host-control members** (`host`, `admin`, `venue_host`) run events, bookings and door check-in.
  **Only they can cancel a booking** (and so release its seats). Guests cannot cancel; the rules reject it.
* **Super admin**: create a document `hosts/{lowercase-email}` in the Firestore console. There is no
  host sign-up screen on purpose (rule R18). Admins then grant roles from the host console, People tab.

## 3. Tickets: prices, tiers and capacity

Prices are set **per event, per tier** in the host console (Bookings, then the event). The Firestore
rules enforce what the app shows, so a modified browser cannot cheat:

* A booking must carry the price of the tier it names (`tierIndex`), and a discount must be a real,
  active entry of that event's discount list with the right amount.
* **Event capacity**: `bookedCount` must rise by exactly `qty x seatsPerTicket` in the same write as the booking.
* **Tier capacity** (tickets, `0` = unlimited): a counter document per tier,
  `bookingEvents/{eventId}/tierCounts/{tierId}`, must rise by exactly `qty` and may not pass the tier's capacity.
  Guests can only raise a counter; host cancellations lower it.
* Payments are mock for now (`paid_mock`). Before wiring a real provider, remove the buyer's own
  `reserved -> paid_mock` update path in `firestore.rules`.

Migration note: tier counters start at 0. If an event already sold tickets before tier capacity was
enforced, set its `tierCounts/{tierId}.booked` values once in the Firestore console (a host can write them).

## 4. Venue search (Google Places) with the key hidden

Hosts search venues while creating an event. Google's key must not be readable in the browser's
Inspect panel, so the browser never talks to Google: it calls a Cloudflare Worker, which holds the key
as a secret, checks the caller is a signed-in host-control member (using their Firebase ID token and the
same Firestore rules), then forwards the request. Cloudflare's free plan (100,000 requests/day) is far more than needed.

One-time setup:

1. **Google Cloud**: enable the *Places API* on the project, create an API key, and restrict it to
   "Places API" only (API restriction). No referrer restriction is needed because only the Worker uses it.
2. **Cloudflare**: create a free account, then from `worker/places-proxy`:
   ```bash
   cd worker/places-proxy
   npx wrangler login
   npx wrangler secret put GOOGLE_PLACES_API_KEY    # paste the key when prompted
   npx wrangler deploy                               # prints https://kartar-places-proxy.<you>.workers.dev
   ```
   Check `wrangler.toml`: `FIREBASE_PROJECT_ID` must match your project, and `ALLOWED_ORIGINS` must list
   every site origin that may call the Worker (your Hosting URLs and `http://localhost:5173`).
3. Put the printed URL in `VITE_PLACES_PROXY_URL` (in `.env.local` for dev, and in your build
   environment for production), then rebuild and redeploy the site.

Local Worker testing: `npx wrangler dev`, with the key in `worker/places-proxy/.dev.vars` (a line `GOOGLE_PLACES_API_KEY=...`,
git-ignored, never commit it), and point `VITE_PLACES_PROXY_URL` at the printed localhost URL.

If the key ever leaks, rotate it in Google Cloud and run `npx wrangler secret put GOOGLE_PLACES_API_KEY` again.

## 5. Deploy

The site is static (Firebase Hosting) plus Firestore rules.

```bash
npm ci && npm test && npm run build
npx -y firebase-tools@latest deploy --only firestore:rules --project kartar-cup   # rules only
npm run deploy                                                                    # hosting + rules
```

You must be logged in. Pick one:

* **Your own machine**: `npx firebase-tools login` once, then run the commands above.
* **CI / a cloud session (no browser)**: create a token on a machine where you can log in:
  ```bash
  npx firebase-tools login:ci        # opens a browser, then prints a long token
  ```
  Store it as the secret environment variable `FIREBASE_TOKEN` in that environment's settings (never in
  chat or in git). The Firebase CLI reads it automatically. `login:ci` tokens are long-lived and
  being phased out by Google: for something durable, create a service account with the *Firebase
  Rules Admin* (rules only) or *Firebase Admin* role, download its JSON key, and set
  `GOOGLE_APPLICATION_CREDENTIALS` to the file path instead.

Always run the rules tests (section 1) before deploying rules.

## 6. Troubleshooting

* Blank "not configured" page: `VITE_FIREBASE_API_KEY` is missing from the build environment.
* Venue search says "Sign in" or "not configured": you are signed out, or `VITE_PLACES_PROXY_URL` is empty.
  `FORBIDDEN` means your account is not a host-control member; `ORIGIN_NOT_ALLOWED` means add the site's
  origin to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy the Worker.
* "Tier is sold out" while seats remain: the tier's own capacity (tickets) is used up; raise it in the event editor.
