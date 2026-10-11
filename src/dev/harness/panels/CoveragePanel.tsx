import type { PanelProps } from '../MockLab';
import { Case } from '../parts';

const EMU = 'Firebase emulator path: README section 1.';

/** Rows audited against panels' actual imports (2026-10-07). Rule: a module is listed as "covered" only if some panel actually imports it; everything else goes in "gap". Area names follow the real tree: src/guest, src/host, src/lib. Update when a folder or panel changes. */
const ROWS: { area: string; panel: string; gap: string }[] = [
  { area: 'Race state display (components/RaceStateDisplay, RaceStateBackdrop, TrackMap)', panel: 'Race states', gap: 'Real race-control feed: states are picked by hand, not derived from live data. lib/raceState is not imported by any panel. RaceStateDisplay runs on the real Date.now(), so the lab clock only moves the race start it is handed.' },
  { area: 'F1 data (lib/raceData, lib/f1api, lib/openf1)', panel: 'Mock OpenF1', gap: 'Real API behaviour: payloads are captured fixtures; live schema drift, real rate limits and CORS are not tested. Re-run scripts/capture-f1-fixtures.mjs to refresh.' },
  { area: 'Quiz and picks (guest/Quiz, QuizBanner, PicksCard, quizGate, draft)', panel: 'Quiz', gap: `Saving entries: real writes, security rules, draft persistence across sign-in, live snapshots. ${EMU}` },
  { area: 'Scoring (lib/scoring, lib/podium)', panel: 'Quiz, Cards, Host console', gap: 'Server-side result entry and re-scoring of stored entries.' },
  { area: 'Booking and pricing (guest/BookingCheckout, bookingModel, lib/pricing)', panel: 'Booking', gap: `Real transactions: capacity under concurrent bookings, payment provider, booking writes, rules. lib/bookings is not imported by any panel at all - it needs Firestore. ${EMU}` },
  { area: 'Tickets (guest/TicketView, TicketActions, MyCards)', panel: 'Ticket', gap: `Loading a ticket by id, auth ownership, QR scan round trip against a real booking. ${EMU}` },
  { area: 'Cards (lib/cards, lib/scoring cardBonusByUid)', panel: 'Cards, Profile', gap: `Issuing and assigning cards to real users, pass-number uniqueness, rules. host/bookings/CardsAdmin, host/CardAssign is not mounted (it reads and writes Firestore); the bonus now comes from quiz answers (R71) via lib/scoring. ${EMU}` },
  { area: 'Results hub (guest/results/ResultsHub, resultsModel)', panel: 'Results', gap: 'Real session data for races not captured as fixtures; only the Malaysia weekend is replayed.' },
  { area: 'Cup and championship (guest/Championship, lib/cupScoring)', panel: 'Cup', gap: `Cup admin writes, results editor persistence, rules. guest/CupPage, lib/cup and host/cup (CupAdmin, ResultsEditor) are not mounted. ${EMU}` },
  { area: 'Big screen (host/screen: LobbyScreen, StandingsScreen, PodiumScreen, Avatar, podium.ts)', panel: 'Big screen', gap: `Live snapshots driving the screen (useScreenData), screen state written by the host console. PodiumController, ScreenApp and useScreenData are not mounted. ${EMU}` },
  { area: 'Host console (host/Leaderboard, CrowdReveal, ResultsForm, bookings/VenueSearch, bookings/roster.ts, bookings/model.ts, settings/time.ts, lib/raceResults, lib/crowd, lib/csv, lib/placeSearch)', panel: 'Host console', gap: `Camera QR scanning, real check-in writes, audit log writes, roles and permissions, venue search against the real Places proxy. ActivityLog and bookings/AttendeeRoster are not mounted as components (each subscribes to Firestore itself); the panel drives their pure modules and a lab rendering instead. CheckinScanner's component is not mounted either - only its statusCopy, in the Ticket panel. ResultsForm IS the real component and imports lib/db, so its Save results button attempts a real Firestore write. ${EMU}` },
  { area: 'Host settings, content, users, invites (host/settings, ContentAdmin, UsersAdmin, InvitePanel, RaceControl, RevealWinner, HostConsole, HostApp)', panel: 'none', gap: `The Booking and Host console panels do exercise host/bookings/model.ts and host/settings/time.ts; no settings or admin component is mounted. Not covered here at all: all of it is admin data entry over Firestore. ${EMU}` },
  { area: 'Guest profile and achievements (guest/ProfilePage, AchievementsSection, profileModel, achievements)', panel: 'Profile', gap: 'Real signed-in user history; the lab feeds fixtures.' },
  { area: 'Auth and routing (lib/auth, firebase, roles, routing, pages/RequireHost, JoinPage, LogoutPage, guest/SignIn, useGuestSession)', panel: 'none', gap: `Sign-in flows, in-app-browser handling, host gating, redirects. Needs Firebase Auth. ${EMU}` },
  { area: 'Page transitions and chrome (guest/transitions, Countdown, Divider, Skeleton, StatusDot, Button, FailurePage, NotFoundPage)', panel: 'Motion & chrome', gap: 'The animated overlay itself (TransitionLayer, graphics) needs real navigation; the panel covers the pure variant selection only. components/motion.tsx is not imported by any panel.' },
  { area: 'Static guest pages (Home, Hero, About, Contact, Events, Gallery, Stories, Partners, Legal, RaceDetail, MobileNav)', panel: 'none', gap: 'Not mounted here: they are content pages. Events list and race detail use lib/content and the schedule, which need Firestore or the live feed.' },
  { area: 'Content, CSV, map, page meta, in-app browser (lib/csv, mapEmbed, placeSearch covered; lib/content, pageMeta, inAppBrowser not)', panel: 'Host console (csv, placeSearch), Booking (mapEmbed)', gap: 'lib/content, lib/pageMeta and lib/inAppBrowser are not imported by any panel; they are covered by unit tests only.' },
  { area: 'Mock Lab itself (src/dev/mockNet.ts, src/dev/fixtures, src/dev/harness)', panel: 'all', gap: 'Covered by src/dev/mockNet.test.ts, src/dev/fixtures/fixtures.test.ts and src/dev/harness/smoke.test.ts (a server render of every panel). No browser-level test: clicks, effects and layout are not asserted anywhere.' },
];

const th = 'px-2 py-1 text-left font-mono text-[0.65rem] font-normal uppercase tracking-widest text-muted';
const td = 'px-2 py-1.5 align-top';

export default function CoveragePanel(_props: PanelProps) {
  return (
    <Case title="Feature coverage" note="One row per feature area of src/guest, src/host and src/lib. Rows with panel 'none' are gaps, not oversights.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>area</th>
              <th className={th}>panel that covers it</th>
              <th className={th}>what is NOT covered here</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.area} className="border-b border-line/60">
                <td className={`${td} text-ink`}>{r.area}</td>
                <td className={`${td} font-mono ${r.panel === 'none' ? 'text-accent-text' : 'text-muted'}`}>{r.panel}</td>
                <td className={`${td} text-muted`}>{r.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Case>
  );
}

