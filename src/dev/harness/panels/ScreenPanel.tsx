import { useMemo, useState, type ReactNode } from 'react';
import { pointsMap, rankEntries } from '../../../lib/scoring';
import type { RankedRow, ScreenMode } from '../../../lib/types';
import Avatar from '../../../host/screen/Avatar';
import LobbyScreen from '../../../host/screen/LobbyScreen';
import PodiumScreen from '../../../host/screen/PodiumScreen';
import StandingsScreen from '../../../host/screen/StandingsScreen';
import { MODE_LABEL, buildPodium, clampStage, isRevealed, nextStage, prevStage, type Stage } from '../../../host/screen/podium';
import { ts, mockEntries, mockEventConfig, mockMaxScore, mockRanked, mockResults, mockScreenState } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, LabButton, Pick } from '../parts';

/* ---------- datasets ---------- */

const cfg = mockEventConfig();
const TOTAL = mockMaxScore();
const WEIGHTED = TOTAL !== cfg.questions.length;
const FACE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#4a4a52"/><circle cx="60" cy="48" r="22" fill="#2a2a2e"/><path d="M16 120c4-30 22-42 44-42s40 12 44 42z" fill="#2a2a2e"/></svg>',
)}`;
const BROKEN_FACE = 'data:image/png;base64,AAAA'; // decodes to nothing: triggers the img onError fallback

/** Re-rank the fixture guests without Play cards. `topTie` gives guest 1 the same answers as guest 12 (the 5-point leader). */
function rank(override: string | null, topTie: boolean): RankedRow[] {
  const e = mockEntries();
  const scorable = e.map((x) => ({ uid: x.uid, name: x.name, photoURL: x.photoURL, answers: x.answers, submittedAtMs: x.submittedAt.toMillis() }));
  if (topTie) scorable[0] = { ...scorable[0], answers: scorable[11].answers };
  return rankEntries(scorable, mockResults(), override, cfg.questionIds, pointsMap(cfg.questions));
}

interface Dataset {
  id: string;
  label: string;
  note: string;
  rows: RankedRow[];
}

function datasets(): Dataset[] {
  const base = mockRanked();
  return [
    { id: 'fixtures', label: 'Fixture grid (12)', note: 'mockRanked(): a four-way tie at 3 points (ranks 3 to 6 differ only by submit time) and two Play-card bonus rows (R46). A sole leader on 5.', rows: base },
    { id: 'top-tie', label: 'Tie for the lead', note: 'Re-ranked without cards, guest 1 given the leader answers: two guests on 5, split by earlier submit time (guest 1 first).', rows: rank(null, true) },
    { id: 'override-promoted', label: 'Override: promoted', note: "overrideUid = guest 12, who is tied for the lead but behind on submit time. The host's pick moves ahead of the tie.", rows: rank('mock-uid-12', true) },
    { id: 'override-ignored', label: 'Override: not top (ignored)', note: 'overrideUid = guest 5, who is NOT tied for the lead. rankEntries only reorders within the top-score tie, so the order is unchanged. A host cannot spotlight a non-top guest this way.', rows: rank('mock-uid-05', true) },
    {
      id: 'photos',
      label: 'Photos / no photo',
      note: 'Rows 1, 3 and 5 carry a photoURL (inline SVG, no network), row 2 a broken image (falls back to initials on error), the rest none (initials).',
      rows: base.map((r, i) => (i === 1 ? { ...r, photoURL: BROKEN_FACE } : i % 2 === 0 && i < 6 ? { ...r, photoURL: FACE } : { ...r, photoURL: undefined })),
    },
    { id: 'two', label: 'Two entries', note: 'Fewer than three: P3 stays an empty grid slot even after stage 1.', rows: mockRanked(2) },
    { id: 'one', label: 'One entry', note: 'Only P1 can be revealed.', rows: mockRanked(1) },
    { id: 'zero', label: 'No entries', note: 'Standings shows its empty message; the podium shows three empty slots.', rows: [] },
  ];
}

/* ---------- projector frame ---------- */

/**
 * The screens are built for a projector or TV: full-bleed, 16:9, text sized with viewport units, minimum
 * height 100dvh. Here each one renders at the lab window's size and is scaled to half inside a 16:9
 * bordered box, so what you see is the real layout shrunk, not a reflowed one. The box clips; the real
 * display is /host/screen.
 */
function Projector({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="relative isolate aspect-video w-full overflow-hidden rounded-md border border-ink bg-base">
      <div className="absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50 overflow-hidden text-ink">{children}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-line px-2 py-1 text-left font-mono text-[0.65rem] font-medium uppercase tracking-widest text-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1 text-ink">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MODES: { id: ScreenMode; label: string }[] = (['lobby', 'standings', 'podium'] as const).map((id) => ({ id, label: MODE_LABEL[id] }));
const STAGES: { id: `${Stage}`; label: string }[] = [
  { id: '0', label: 'Sealed' },
  { id: '1', label: 'P3' },
  { id: '2', label: 'P2' },
  { id: '3', label: 'P1' },
];

export default function ScreenPanel({ nowMs }: PanelProps) {
  const sets = useMemo(datasets, []);
  const [setId, setSetId] = useState(sets[0].id);
  const [mode, setMode] = useState<ScreenMode>('podium');
  const [stage, setStage] = useState<Stage>(0);
  const data = sets.find((d) => d.id === setId) ?? sets[0];
  const podium = buildPodium(data.rows);
  const screen = mockScreenState({ mode, stage, updatedAt: ts(nowMs) });
  const joinUrl = `${window.location.origin}/play`;
  return (
    <Grid>
      <Case title="Dataset" note={data.note} wide>
        <Pick label="Dataset" value={setId} options={sets.map((d) => ({ id: d.id, label: d.label }))} onChange={setSetId} />
        <p className="mt-2 font-mono text-[0.65rem] text-muted">{data.rows.length} rows · max score {TOTAL}{WEIGHTED ? ' (weighted)' : ''} · screen doc mode {screen.mode}, stage {screen.stage}</p>
      </Case>
      <Case title="Lobby" note="LobbyScreen: event name, join QR and live entry count." wide>
        <Projector label="Lobby screen">
          <LobbyScreen config={cfg} entryCount={data.rows.length} joinUrl={joinUrl} />
        </Projector>
      </Case>
      <Case title="Standings" note="StandingsScreen over the chosen dataset (empty dataset shows the empty message)." wide>
        <Projector label="Standings screen">
          <StandingsScreen config={cfg} ranked={data.rows} />
        </Projector>
      </Case>
      <Case title="Podium reveal" note="PodiumScreen at each stage. Next and Back use the host controller's own stage helpers." wide>
        <div className="flex flex-wrap items-center gap-2">
          <Pick label="Screen mode" value={mode} options={MODES} onChange={setMode} />
          <Pick label="Stage" value={`${stage}` as `${Stage}`} options={STAGES} onChange={(v) => setStage(clampStage(Number(v)))} />
          <LabButton onClick={() => setStage(prevStage(stage))}>Back</LabButton>
          <LabButton onClick={() => setStage(nextStage(stage))}>Next</LabButton>
        </div>
        <div className="mt-3">
          <Projector label="Podium screen">
            <PodiumScreen p1={podium.p1} p2={podium.p2} p3={podium.p3} stage={stage} totalQuestions={TOTAL} weighted={WEIGHTED} />
          </Projector>
        </div>
        <div className="mt-3">
          <Table
            head={['slot', 'revealed', 'guest', 'score']}
            rows={(['p3', 'p2', 'p1'] as const).map((s) => [s, String(isRevealed(stage, s)), podium[s]?.name ?? '-', podium[s] ? String(podium[s]!.score) : '-'])}
          />
        </div>
      </Case>
      <Case title="Avatar" note="Photo, broken photo (falls back to initials) and no photo.">
        <div className="flex items-center gap-4">
          <Avatar photoUrl={FACE} name="Aarav Menon" className="size-14 rounded-full" />
          <Avatar photoUrl={BROKEN_FACE} name="Diya Raman" className="size-14 rounded-full" />
          <Avatar name="Karthik Subbu" className="size-14 rounded-full" />
        </div>
      </Case>
    </Grid>
  );
}
