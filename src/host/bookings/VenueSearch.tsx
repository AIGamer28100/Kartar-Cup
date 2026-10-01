import { useEffect, useRef, useState } from 'react';
import { MapPin } from '@phosphor-icons/react';
import { googleMapsPinUrl, searchPlaces, type PlaceResult } from '../../lib/placeSearch';
import { Field, inputCls } from '../settings/ui';

/** Search-as-you-type venue finder (free, OpenStreetMap data via Photon — no key, no billing).
 * Picking a result fills the venue name, city and an exact Google Maps pin; every field stays
 * editable afterwards, and a venue the search can't find is just typed in by hand. */
export default function VenueSearch({ onPick }: { onPick: (p: { name: string; city: string; mapUrl: string }) => void }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 3) {
      setResults(null);
      setBusy(false);
      return;
    }
    const id = ++run.current;
    const ctl = new AbortController();
    setBusy(true);
    const t = setTimeout(() => {
      void searchPlaces(q, ctl.signal).then((r) => {
        if (id !== run.current) return;
        setResults(r);
        setBusy(false);
      });
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [text]);

  function pick(p: PlaceResult) {
    onPick({ name: p.name, city: p.city, mapUrl: googleMapsPinUrl(p) });
    setText('');
    setResults(null);
  }

  return (
    <div className="mb-5">
      <Field
        id="f-venue-search"
        label="Find a venue"
        hint="Search by name and area, pick a result to fill the fields below. Can't find it? Type the details in yourself."
      >
        <input
          id="f-venue-search"
          type="search"
          autoComplete="off"
          className={inputCls}
          placeholder="e.g. Marina Beach Chennai"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <div aria-live="polite" className="mt-2 text-sm text-muted">
        {busy && 'Searching…'}
        {!busy && results && results.length === 0 && 'No matches. Try the area or city too, or type it in below.'}
      </div>
      {results && results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-raised">
          {results.map((r) => (
            <li key={r.label + r.lat}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-base focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <MapPin size={18} weight="regular" aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
                <span className="text-ink">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Search data © OpenStreetMap contributors</p>
    </div>
  );
}
