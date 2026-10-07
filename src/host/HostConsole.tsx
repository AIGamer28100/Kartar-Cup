import { useMemo, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import Button from '../components/Button';
import FailurePage from '../components/FailurePage';
import { RowsSkeleton } from '../components/Skeleton';
import { useTimedOut } from '../lib/useTimedOut';
import { EVENT_NAME } from '../config/event';
import { toCsv } from '../lib/csv';
import { maxScore, pointsMap, rankEntries, winner } from '../lib/scoring';
import type { ScorableEntry } from '../lib/types';
import CrowdReveal from './CrowdReveal';
import Leaderboard from './Leaderboard';
import PodiumController from './screen/PodiumController';
import ResultsForm from './ResultsForm';
import RaceControl from './RaceControl';
import RevealWinner from './RevealWinner';
import { useCardBonus } from './useCardBonus';
import { useHostData } from './useHostData';

export default function HostConsole() {
  const { loading, error, config, entries, resultsDoc, results } = useHostData();
  const stuck = useTimedOut(loading);
  const cardBonus = useCardBonus(config?.raceId);
  const [localOverride, setLocalOverride] = useState<string | null | undefined>(undefined);
  const overrideUid = localOverride !== undefined ? localOverride : (config?.tiebreakOverride ?? null);

  const ranked = useMemo(() => {
    const scorable: ScorableEntry[] = entries.map((e) => ({
      uid: e.uid,
      name: e.name,
      answers: e.answers,
      submittedAtMs: e.submittedAt.toMillis(),
    }));
    // Without a config (nothing live) fall back to the defaults, exactly as before.
    return rankEntries(scorable, results, overrideUid, config?.questionIds, config ? pointsMap(config.questions) : undefined, cardBonus);
  }, [entries, results, overrideUid, config, cardBonus]);

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
    a.download = `${(config?.name ?? EVENT_NAME).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-entries.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) {
    // Never an endless skeleton: a load failure (e.g. permission-denied) or 12 s of silence shows the failure page.
    if (error || stuck) return <FailurePage error={error ?? 'The entries feed did not answer in time.'} />;
    return <RowsSkeleton />;
  }

  return (
    <div>
      {error && (
        <p role="alert" className="border-b border-line py-3 text-accent-text">
          Results feed hiccup: {error}
        </p>
      )}
      <RaceControl config={config} count={entries.length} />
      <Leaderboard
        rows={ranked}
        overrideUid={overrideUid}
        canPick={!config?.winnerRevealed}
        questions={config?.questions}
        onPick={setLocalOverride}
      />
      <RevealWinner
        winner={winner(ranked)}
        overrideUid={overrideUid}
        revealed={config?.winnerRevealed ?? false}
        max={config ? maxScore(config.questions) : undefined}
      />
      <CrowdReveal config={config} entries={entries} results={results} />
      <ResultsForm config={config} resultsDoc={resultsDoc} results={results} />
      <PodiumController />
      <div className="py-8">
        <Button variant="secondary" disabled={entries.length === 0} onClick={exportCsv}>
          <DownloadSimple size={20} weight="regular" aria-hidden="true" /> Export entries CSV
        </Button>
      </div>
    </div>
  );
}
