# Tasks & Fixes Requested

## Race State Display
- [x] Fix "Lights out in" / "elapsed" contradictory display bug
- [x] Show "RACE IN PROGRESS" when race is live
- [x] Show "YELLOW FLAG", "RED FLAG" during flag conditions
- [x] Show "LAST LAP" / "CHEQUERED FLAG" during final lap
- [x] Show top 3 winners (podium) on home page when race completed
- [x] Fix "calsification" typo → "classification"
- [x] Remove ManualStateOverride (debug code) from frontend
- [x] Fix RaceStateDisplay palette to match app palette (use app's color tokens)
- [x] Add ice/crystal animations for all flag states
- [x] Use OpenF1 API for race results

## Google Places API Integration
- [x] Replace OpenStreetMap/Photon with Google Places Autocomplete
- [x] Add fetchPlaceDetails() for exact lat/lng from place_id
- [x] Proper error handling with typed PlacesError union
- [x] Vite dev proxy for CORS handling

## Per-Tier Capacity & Bundled Tickets
- [x] Add `capacity` and `seatsPerTicket` to PriceTier
- [x] applyDiscount returns totalSeats = qty * seatsPerTicket
- [x] Server-side validation in createReservation (event + tier capacity)
- [x] UI filters out sold-out tiers, shows remaining tickets
- [x] Bundled tickets (e.g., 4 entries/ticket × 2 capacity = 2 tickets max)

## Race State Display
- [x] Complete F1 flag state system: scheduled, in-progress, yellow-flag, yellow-flag-sector, red-flag, virtual-safety-car, last-lap, chequered-flag, completed, cancelled-by-host
- [x] Ice crystal animations with Framer Motion
- [x] Live timer (countdown before start, elapsed during race)
- [x] Manual override panel removed (debug code)
- [x] Integrated into HomePage hero section
- [x] Palette matches app design system (use app color tokens)

## Partial Check-in & Host-Only Cancellation
- [x] Added checkedInCount to Booking type
- [x] checkIn() supports partial check-in with count parameter
- [x] Status stays paid_mock until fully checked in
- [x] cancelBooking is host-only, releases qty * seatsPerTicket seats
- [x] Removed guest self-cancellation UI

## Host Booking Admin Nested Routes
- [x] URL structure: /host/bookings/new, /host/bookings/:eventId/edit, /host/bookings/:eventId/attendees, /host/bookings/:eventId/cards
- [x] Extracted BookingEventForm, BookingEventAttendees, BookingEventCards
- [x] Uses React Router Outlet for nested routing

## Nested Routes for Other Admin Sections
- [ ] CupAdmin: /host/cup/new, /host/cup/:seasonId/edit, /host/cup/:seasonId/rounds/:roundId/results
- [ ] ContentAdmin: /host/content/partners/new, /host/content/partners/:id/edit, /host/content/stories/new, /host/content/legal/new
- [ ] UsersAdmin: /host/users/:userId/edit

## TypeScript & Build Fixes
- [x] Fixed all TypeScript errors across codebase
- [x] Fixed JSX structure issues in RaceStateDisplay (wrapped children in fragment)
- [x] Removed ManualStateOverride (debug code)
- [x] Fixed RaceStateDisplay palette to match app palette
- [x] Fixed EventDetails function signature to include preview prop
- [x] Added user prop back to OrderSummary
- [x] Removed unused imports (venueDirectionsUrl, mapLinkCls, etc.)
- [x] Fixed unused variable warnings (isBeforeStart, pulseOpacity, pulseScale, etc.)
- [x] Removed ManualStateOverride component entirely

## OpenF1 API Integration
- [ ] Fetch race results from OpenF1 API
- [ ] Display top 3 podium finishers on home page when race completed

## Palette/Theming
- [x] RaceStateDisplay uses app palette (bg-raised, border-line, text-ink, text-muted, text-accent)
- [x] Status badges use app color tokens
- [x] Ice crystal animations match app theme