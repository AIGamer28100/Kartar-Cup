import { useMemo, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import Button from '../components/Button';
import FailurePage from '../components/FailurePage';
import { RowsSkeleton } from '../components/Skeleton';
import { useTimedOut } from '../lib/useTimedOut';
import { EVENT_NAME } from '../config/event';
import { toCsv } from '../lib/csv';
import { rankEntries, winner } from '../lib/scoring';
import type { ScorableEntry } from '../lib/types';
import Leaderboard from './Leaderboard';
import ResultsForm from './ResultsForm';
import RevealWinner from './RevealWinner';
import StatusPanel from './StatusPanel';
import { useHostData } from './useHostData';

export default function HostConsole() {
  const { loading, error, event, entries, resultsDoc, results } = useHostData();
  const stuck = useTimedOut(loading);
  const [localOverride, setLocalOverride] = useState<string | null | undefined>(undefined);
  const overrideUid = localOverride !== undefined ? localOverride : (event?.tiebreakOverride ?? null);

  const ranked = useMemo(() => {
    const scorable: ScorableEntry[] = entries.map((e) => ({
      uid: e.uid,
      name: e.name,
      answers: e.answers,
      submittedAtMs: e.submittedAt.toMillis(),
    }));
    return rankEntries(scorable, results, overrideUid);
  }, [entries, results, overrideUid]);

  function exportCsv() {
    const byUid = new Map(entries.map((e) => [e.uid, e]));
    const rows = ranked.map((r) => {
      const e = byUid.get(r.uid);
      return {
        ...r,
        email: e?.email,
        phone: e?.phone,
        submittedAtIso: new Date(r.submittedAtMs).toISOString(),
      };
    });
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${EVENT_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-entries.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    // Never an endless skeleton: a load failure (e.g. permission-denied) or 12 s of silence shows the failure page.
    if (error || stuck) return <FailurePage error={error ?? 'The entries feed did not answer in time.'} />;
    return <RowsSkeleton />;
  }

  return (
    <div>
      {error && (
        <p role="alert" className="border-b border-line py-3 text-accent">
          Results feed hiccup: {error}
        </p>
      )}
      <StatusPanel event={event} count={entries.length} />
      <Leaderboard
        rows={ranked}
        overrideUid={overrideUid}
        canPick={!event?.winnerRevealed}
        onPick={setLocalOverride}
      />
      <RevealWinner
        winner={winner(ranked)}
        overrideUid={overrideUid}
        revealed={event?.winnerRevealed ?? false}
      />
      <ResultsForm resultsDoc={resultsDoc} results={results} />
      <div className="py-8">
        <Button variant="secondary" disabled={entries.length === 0} onClick={exportCsv}>
          <DownloadSimple size={20} weight="regular" /> Export entries CSV
        </Button>
      </div>
    </div>
  );
}
