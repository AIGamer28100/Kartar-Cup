import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { MapPin } from '@phosphor-icons/react';
import { googleMapsPinUrl, searchPlaces, fetchPlaceDetails } from '../../lib/placeSearch';
import { Field, inputCls } from '../settings/ui';
/** Search-as-you-type venue finder using Google Places API.
 * Picking a result fills the venue name, city, place_id and a Google Maps pin link; every field stays
 * editable afterwards, and a venue the search can't find is just typed in by hand. */
export default function VenueSearch({ onPick }) {
    const [text, setText] = useState('');
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const run = useRef(0);
    useEffect(() => {
        const q = text.trim();
        if (q.length < 3) {
            setResults(null);
            setError(null);
            setBusy(false);
            return;
        }
        const id = ++run.current;
        const ctl = new AbortController();
        setBusy(true);
        setError(null);
        const t = setTimeout(() => {
            void searchPlaces(q, ctl.signal).then((r) => {
                if (id !== run.current)
                    return;
                if (Array.isArray(r)) {
                    setResults(r);
                }
                else {
                    setError(r);
                    setResults([]);
                }
                setBusy(false);
            });
        }, 400);
        return () => {
            clearTimeout(t);
            ctl.abort();
        };
    }, [text]);
    async function pick(p) {
        // If we have a place_id, fetch details to get real lat/lng for a proper pin URL.
        // Otherwise fall back to search URL.
        let mapUrl = '';
        if (p.place_id) {
            const details = await fetchPlaceDetails(p.place_id);
            if (Array.isArray(details)) {
                // Should never happen - details returns object or PlacesError
            }
            else if ('lat' in details && 'lng' in details) {
                mapUrl = googleMapsPinUrl(details);
            }
            else {
                // Details fetch failed - fall back to search
                mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + p.city)}`;
            }
        }
        else {
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + p.city)}`;
        }
        onPick({ name: p.name, city: p.city, mapUrl, place_id: p.place_id });
        setText('');
        setResults(null);
        setError(null);
    }
    return (_jsxs("div", { className: "mb-5", children: [_jsx(Field, { id: "f-venue-search", label: "Find a venue", hint: "Search by name and area, pick a result to fill the fields below. Can't find it? Type the details in yourself.", children: _jsx("input", { id: "f-venue-search", type: "search", autoComplete: "off", className: inputCls, placeholder: "e.g. Marina Beach Chennai", value: text, onChange: (e) => setText(e.target.value) }) }), _jsxs("div", { "aria-live": "polite", className: "mt-2 text-sm text-muted", children: [busy && 'Searching…', !busy && error && (_jsxs("span", { className: "text-destructive", children: ["Search failed: ", error.status, error.error_message && ` — ${error.error_message}`] })), !busy && !error && results && results.length === 0 && 'No matches. Try the area or city too, or type it in below.'] }), results && results.length > 0 && (_jsx("ul", { className: "mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-raised", children: results.map((r) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => pick(r), className: "flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-base focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent", children: [_jsx(MapPin, { size: 18, weight: "regular", "aria-hidden": "true", className: "mt-0.5 shrink-0 text-accent-text" }), _jsx("span", { className: "text-ink", children: r.label })] }) }, r.label))) })), _jsx("p", { className: "mt-2 text-xs text-muted", children: "Search data \u00A9 Google Places API" })] }));
}
