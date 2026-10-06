import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
const tabCls = 'inline-flex min-h-11 items-center px-3 text-muted hover:text-ink aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
// Wrapper components for nested routes
function SeasonEditorWrapper() {
    const navigate = useNavigate();
    const { eventId } = useParams();
    const [season, setSeason] = useState(null);
    useEffect(() => {
        if (!eventId)
            return;
        const unsub = watchAllSeasons((seasons) => {
            const s = seasons.find(s => s.id === eventId);
            if (s)
                setSeason(s);
        });
        return unsub;
    }, [eventId]);
    if (!season)
        return null;
    return _jsx(SeasonEditor, { season: season, onBack: () => navigate('../..') });
}
function SeasonEditorWrapper2() {
    const navigate = useNavigate();
    const { seasonId } = useParams();
    const [season, setSeason] = useState(null);
    useEffect(() => {
        if (!seasonId)
            return;
        const unsub = watchAllSeasons((seasons) => {
            const s = seasons.find(s => s.id === seasonId);
            if (s)
                setSeason(s);
        });
        return unsub;
    }, [seasonId]);
    if (!season)
        return null;
    return _jsx(SeasonEditor, { season: season, onBack: () => navigate('../..') });
}
function ResultsEditorWrapper() {
    const navigate = useNavigate();
    const { seasonId, roundId } = useParams();
    const [round, setRound] = useState(null);
    const [drivers, setDrivers] = useState([]);
    useEffect(() => {
        if (!seasonId || !roundId)
            return;
        watchRounds(seasonId, false, (rounds) => {
            const r = rounds.find(r => r.id === roundId);
            if (r)
                setRound(r);
        });
        const unsubDrivers = watchDrivers(seasonId, setDrivers);
        return () => { unsubDrivers(); };
    }, [seasonId, roundId]);
    if (!round)
        return null;
    return _jsx(ResultsEditor, { seasonId: seasonId, round: round, drivers: drivers, onClose: () => navigate('../..') });
}
function RoundFormWrapper() {
    const navigate = useNavigate();
    const { seasonId, roundId } = useParams();
    const isEditing = Boolean(roundId);
    if (isEditing) {
        const [round, setRound] = useState(null);
        useEffect(() => {
            if (!roundId)
                return;
            let live = true;
            const unsub = watchRounds(seasonId, false, (rounds) => {
                const r = rounds.find(r => r.id === roundId);
                if (r && live)
                    setRound(r);
            });
            return () => { };
        }, [seasonId, roundId]);
        if (!round)
            return null;
        return _jsx(RoundForm, { seasonId: seasonId, initial: round, onDone: () => navigate('../..') });
    }
    return _jsx(RoundForm, { seasonId: seasonId, initial: { id: '', name: '', date: '', order: 1, status: 'scheduled', published: false }, onDone: () => navigate('..') });
}
function PartnerFormWrapper() {
    const navigate = useNavigate();
    const { partnerId } = useParams();
    const [partner, setPartner] = useState(null);
    useEffect(() => {
        if (!partnerId)
            return;
        let live = true;
        const unsub = watchAllPartners((partners) => {
            const p = partners.find(p => p.id === partnerId);
            if (p)
                setPartner(p);
        });
        return () => { };
    }, [partnerId]);
    return _jsx(PartnerForm, { partner: partner || undefined, onDone: () => navigate('../..') });
}
function StoryFormWrapper() {
    const navigate = useNavigate();
    const { storyId } = useParams();
    const [story, setStory] = useState(null);
    const isEditing = Boolean(storyId);
    useEffect(() => {
        if (!storyId)
            return;
        const unsub = watchAllStories((stories) => {
            const s = stories.find(s => s.id === storyId);
            if (s)
                setStory(s);
        });
        return unsub;
    }, [storyId]);
    if (isEditing && !story)
        return null;
    return _jsx(StoryForm, { story: story || undefined, onDone: () => navigate('../..') });
}
function LegalFormWrapper() {
    const navigate = useNavigate();
    const { docId } = useParams();
    const [doc, setDoc] = useState(null);
    const [partners, setPartners] = useState([]);
    const isEditing = Boolean(docId);
    useEffect(() => {
        if (docId) {
            const unsub = watchLegalDocs((docs) => {
                const d = docs.find(d => d.id === docId);
                if (d)
                    setDoc(d);
            });
            return () => { };
        }
        const unsub = watchAllPartners((ps) => setPartners(ps));
        return () => { };
    }, [docId]);
    if (isEditing && !doc)
        return null;
    return _jsx(LegalForm, { doc: doc || undefined, seed: undefined, partners: partners, onDone: () => navigate('../..') });
}
function UserList() {
    const navigate = useNavigate();
    const { userId } = useParams();
    const [user, setUser] = useState(null);
    useEffect(() => {
        if (!userId)
            return;
        const unsub = watchAllUsers((users) => {
            const u = users.find(u => u.uid === userId);
            if (u)
                setUser(u);
        });
        return unsub;
    }, [userId]);
    if (!user)
        return null;
    return (_jsxs("div", { className: "p-4", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Edit User" }), _jsxs("p", { className: "text-muted mb-4", children: ["User: ", user.name || user.email] }), _jsx("button", { onClick: () => navigate('..'), className: "min-h-11 px-5 text-[1rem] font-medium text-ink transition hover:text-muted", children: "Back" })] }));
}
/** Host area (already behind RequireHost). Lazy-loaded so guests never download it. */
export default function HostApp() {
    const { access } = useAuth();
    return (_jsxs(HostFrame, { signedIn: true, children: [_jsxs("nav", { "aria-label": "Host sections", className: "flex gap-2 border-b border-line py-2", children: [_jsx(NavLink, { to: "/host", end: true, className: tabCls, children: "Console" }), _jsx(NavLink, { to: "/host/settings", className: tabCls, children: "Settings" }), _jsx(NavLink, { to: "/host/bookings", className: tabCls, children: "Bookings" }), access?.isHost && (_jsx(NavLink, { to: "/host/cup", className: tabCls, children: "Cup" })), _jsx(NavLink, { to: "/host/checkin", className: tabCls, children: "Check-in" }), _jsx(NavLink, { to: "/host/activity", className: tabCls, children: "Activity" }), access?.isHost && (_jsx(NavLink, { to: "/host/content", className: tabCls, children: "Content" })), access?.isHost && (_jsx(NavLink, { to: "/host/users", className: tabCls, children: "People" }))] }), _jsxs(Routes, { children: [_jsx(Route, { index: true, element: _jsx(HostConsole, {}) }), _jsx(Route, { path: "settings", element: _jsx(SettingsPage, {}) }), _jsxs(Route, { path: "bookings", element: _jsx(BookingsAdmin, {}), children: [_jsx(Route, { index: true, element: _jsx(Outlet, {}) }), _jsx(Route, { path: "new", element: _jsx(BookingEventForm, {}) }), _jsx(Route, { path: ":eventId/edit", element: _jsx(BookingEventForm, {}) }), _jsx(Route, { path: ":eventId/attendees", element: _jsx(BookingEventAttendees, {}) }), _jsx(Route, { path: ":eventId/cards", element: _jsx(BookingEventCards, {}) })] }), _jsxs(Route, { path: "cup", element: _jsx(CupAdmin, {}), children: [_jsx(Route, { index: true, element: _jsx(Outlet, {}) }), _jsx(Route, { path: "new", element: _jsx(SeasonEditorWrapper, {}) }), _jsx(Route, { path: ":seasonId/edit", element: _jsx(SeasonEditorWrapper2, {}) }), _jsx(Route, { path: ":seasonId/rounds/:roundId/results", element: _jsx(ResultsEditorWrapper, {}) }), _jsx(Route, { path: ":seasonId/rounds/new", element: _jsx(RoundFormWrapper, {}) }), _jsx(Route, { path: ":seasonId/rounds/:roundId/edit", element: _jsx(RoundFormWrapper, {}) })] }), _jsx(Route, { path: "checkin", element: _jsx(CheckinScanner, {}) }), _jsx(Route, { path: "activity", element: _jsx(ActivityLog, {}) }), _jsxs(Route, { path: "content", element: _jsx(ContentAdmin, {}), children: [_jsx(Route, { index: true, element: _jsx(Outlet, {}) }), _jsx(Route, { path: "partners/new", element: _jsx(PartnerFormWrapper, {}) }), _jsx(Route, { path: "partners/:partnerId/edit", element: _jsx(PartnerFormWrapper, {}) }), _jsx(Route, { path: "stories/new", element: _jsx(StoryFormWrapper, {}) }), _jsx(Route, { path: "stories/:storyId/edit", element: _jsx(StoryFormWrapper, {}) }), _jsx(Route, { path: "legal/new", element: _jsx(LegalFormWrapper, {}) }), _jsx(Route, { path: "legal/:docId/edit", element: _jsx(LegalFormWrapper, {}) })] }), _jsxs(Route, { path: "users", element: _jsx(UsersAdmin, {}), children: [_jsx(Route, { index: true, element: _jsx(Outlet, {}) }), _jsx(Route, { path: ":userId/edit", element: _jsx(UserList, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/host", replace: true }) })] })] }));
}
