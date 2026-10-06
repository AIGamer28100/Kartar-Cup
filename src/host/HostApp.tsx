import { Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router';
import { HostFrame } from '../pages/HostFrame';
import ActivityLog from './ActivityLog';
import BookingsAdmin, { BookingEventForm, BookingEventAttendees, BookingEventCards } from './bookings/BookingsAdmin';
import CheckinScanner from './CheckinScanner';
import ContentAdmin, { PartnerForm, StoryForm, LegalForm } from './ContentAdmin';
import CupAdmin, { SeasonEditor, ResultsEditor, RoundForm } from './cup/CupAdmin';
import HostConsole from './HostConsole';
import SettingsPage from './settings/SettingsPage';
import UsersAdmin from './UsersAdmin';
import { watchAllSeasons, watchRounds, watchDrivers } from '../lib/cup';
import { watchAllPartners, watchAllStories, watchLegalDocs } from '../lib/content';
import { watchAllUsers } from '../lib/users';
import { useAuth } from '../lib/auth';
import { useState, useEffect } from 'react';
import { CupSeason, CupRound, CupDriver } from '../lib/cup';
import { Partner, Story, LegalDoc } from '../lib/content';
import { UserRecord } from '../lib/users';

const tabCls =
  'inline-flex min-h-11 items-center px-3 text-muted hover:text-ink aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

// Wrapper components for nested routes

function SeasonEditorWrapper() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId?: string }>();
  const [season, setSeason] = useState<CupSeason | null>(null);
  
  useEffect(() => {
    if (!eventId) return;
    const unsub = watchAllSeasons((seasons) => {
      const s = seasons.find(s => s.id === eventId);
      if (s) setSeason(s);
    });
    return unsub;
  }, [eventId]);

  if (!season) return null;
  
  return <SeasonEditor season={season} onBack={() => navigate('../..')} />;
}

function SeasonEditorWrapper2() {
  const navigate = useNavigate();
  const { seasonId } = useParams<{ seasonId?: string }>();
  const [season, setSeason] = useState<CupSeason | null>(null);
  
  useEffect(() => {
    if (!seasonId) return;
    const unsub = watchAllSeasons((seasons) => {
      const s = seasons.find(s => s.id === seasonId);
      if (s) setSeason(s);
    });
    return unsub;
  }, [seasonId]);

  if (!season) return null;
  
  return <SeasonEditor season={season} onBack={() => navigate('../..')} />;
}

function ResultsEditorWrapper() {
  const navigate = useNavigate();
  const { seasonId, roundId } = useParams<{ seasonId?: string; roundId?: string }>();
  const [round, setRound] = useState<CupRound | null>(null);
  const [drivers, setDrivers] = useState<CupDriver[]>([]);
  
  useEffect(() => {
    if (!seasonId || !roundId) return;
    watchRounds(seasonId, false, (rounds) => {
      const r = rounds.find(r => r.id === roundId);
      if (r) setRound(r);
    });
    const unsubDrivers = watchDrivers(seasonId!, setDrivers);
    return () => { unsubDrivers(); };
  }, [seasonId, roundId]);

  if (!round) return null;
  
  return <ResultsEditor seasonId={seasonId!} round={round} drivers={drivers} onClose={() => navigate('../..')} />;
}

function RoundFormWrapper() {
  const navigate = useNavigate();
  const { seasonId, roundId } = useParams<{ seasonId?: string; roundId?: string }>();
  const isEditing = Boolean(roundId);
  
  if (isEditing) {
    const [round, setRound] = useState<CupRound | null>(null);
    useEffect(() => {
      if (!roundId) return;
      watchRounds(seasonId!, false, (rounds) => {
        const r = rounds.find(r => r.id === roundId);
        if (r) setRound(r);
      });
      return () => { /* cleanup */ };
    }, [seasonId, roundId]);
    
    if (!round) return null;
    return <RoundForm seasonId={seasonId!} initial={round} onDone={() => navigate('../..')} />;
  }
  
  return <RoundForm seasonId={seasonId!} initial={{ id: '', name: '', date: '', order: 1, status: 'scheduled', published: false }} onDone={() => navigate('..')} />;
}

function PartnerFormWrapper() {
  const navigate = useNavigate();
  const { partnerId } = useParams<{ partnerId?: string }>();
  const [partner, setPartner] = useState<Partner | null>(null);
  
  useEffect(() => {
    if (!partnerId) return;
    const unsub = watchAllPartners((partners) => {
      const p = partners.find(p => p.id === partnerId);
      if (p) setPartner(p);
    });
    
    return () => { unsub(); };
  }, [partnerId]);

  return <PartnerForm partner={partner || undefined} onDone={() => navigate('../..')} />;
}

function StoryFormWrapper() {
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId?: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const isEditing = Boolean(storyId);
  
  useEffect(() => {
    if (!storyId) return;
    const unsub = watchAllStories((stories) => {
      const s = stories.find(s => s.id === storyId);
      if (s) setStory(s);
    });
    return () => { unsub(); };
  }, [storyId]);

  if (isEditing && !story) return null;
  
  return <StoryForm story={story || undefined} onDone={() => navigate('../..')} />;
}

function LegalFormWrapper() {
  const navigate = useNavigate();
  const { docId } = useParams<{ docId?: string }>();
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const isEditing = Boolean(docId);
  
  useEffect(() => {
    if (docId) {
      const unsubLegal = watchLegalDocs((docs) => {
        const d = docs.find(d => d.id === docId);
        if (d) setDoc(d);
      });
      return () => { unsubLegal(); };
    }
    
    const unsubPartners = watchAllPartners((ps) => setPartners(ps));
    return () => { unsubPartners(); };
  }, [docId]);

  if (isEditing && !doc) return null;
  
  return <LegalForm doc={doc || undefined} seed={undefined} partners={partners} onDone={() => navigate('../..')} />;
}

function UserList() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const [user, setUser] = useState<UserRecord | null>(null);
  
  useEffect(() => {
    if (!userId) return;
    const unsub = watchAllUsers((users) => {
      const u = users.find(u => u.uid === userId);
      if (u) setUser(u);
    });
    return () => { unsub(); };
  }, [userId]);

  if (!user) return null;
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Edit User</h2>
      <p className="text-muted mb-4">User: {user.name || user.email}</p>
      <button onClick={() => navigate('..')} className="min-h-11 px-5 text-[1rem] font-medium text-ink transition hover:text-muted">Back</button>
    </div>
  );
}

/** Host area (already behind RequireHost). Lazy-loaded so guests never download it. */
export default function HostApp() {
  const { access } = useAuth();
  return (
    <HostFrame signedIn>
      <nav aria-label="Host sections" className="flex gap-2 border-b border-line py-2">
        <NavLink to="/host" end className={tabCls}>
          Console
        </NavLink>
        <NavLink to="/host/settings" className={tabCls}>
          Settings
        </NavLink>
        <NavLink to="/host/bookings" className={tabCls}>
          Bookings
        </NavLink>
        {access?.isHost && (
          <NavLink to="/host/cup" className={tabCls}>
            Cup
          </NavLink>
        )}
        <NavLink to="/host/checkin" className={tabCls}>
          Check-in
        </NavLink>
        <NavLink to="/host/activity" className={tabCls}>
          Activity
        </NavLink>
        {access?.isHost && (
          <NavLink to="/host/content" className={tabCls}>
            Content
          </NavLink>
        )}
        {access?.isHost && (
          <NavLink to="/host/users" className={tabCls}>
            People
          </NavLink>
        )}
      </nav>
      <Routes>
        <Route index element={<HostConsole />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="bookings" element={<BookingsAdmin />}>
          <Route index element={<Outlet />} />
          <Route path="new" element={<BookingEventForm />} />
          <Route path=":eventId/edit" element={<BookingEventForm />} />
          <Route path=":eventId/attendees" element={<BookingEventAttendees />} />
          <Route path=":eventId/cards" element={<BookingEventCards />} />
        </Route>
        <Route path="cup" element={<CupAdmin />}>
          <Route index element={<Outlet />} />
          <Route path="new" element={<SeasonEditorWrapper />} />
          <Route path=":seasonId/edit" element={<SeasonEditorWrapper2 />} />
          <Route path=":seasonId/rounds/:roundId/results" element={<ResultsEditorWrapper />} />
          <Route path=":seasonId/rounds/new" element={<RoundFormWrapper />} />
          <Route path=":seasonId/rounds/:roundId/edit" element={<RoundFormWrapper />} />
        </Route>
        <Route path="checkin" element={<CheckinScanner />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="content" element={<ContentAdmin />}>
          <Route index element={<Outlet />} />
          <Route path="partners/new" element={<PartnerFormWrapper />} />
          <Route path="partners/:partnerId/edit" element={<PartnerFormWrapper />} />
          <Route path="stories/new" element={<StoryFormWrapper />} />
          <Route path="stories/:storyId/edit" element={<StoryFormWrapper />} />
          <Route path="legal/new" element={<LegalFormWrapper />} />
          <Route path="legal/:docId/edit" element={<LegalFormWrapper />} />
        </Route>
        <Route path="users" element={<UsersAdmin />}>
          <Route index element={<Outlet />} />
          <Route path=":userId/edit" element={<UserList />} />
        </Route>
        <Route path="*" element={<Navigate to="/host" replace />} />
      </Routes>
    </HostFrame>
  );
}