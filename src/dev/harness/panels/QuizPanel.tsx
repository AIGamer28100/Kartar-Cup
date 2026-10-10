import { useMemo, useState } from 'react';
import PicksCard from '../../../guest/PicksCard';
import Quiz from '../../../guest/Quiz';
import QuizBanner from '../../../guest/QuizBanner';
import { CloseTimer } from '../../../guest/parts';
import { quizGateVariant } from '../../../guest/quizGate';
import type { PickMap } from '../../../guest/draft';
import { deriveStatus } from '../../../lib/eventStatus';
import type { DerivedStatus, EventConfig } from '../../../lib/types';
import { mockEventConfig, mockMaxScore, mockRanked, ts } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, LabButton, Pick } from '../parts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const STATUSES: DerivedStatus[] = ['scheduled', 'open', 'closed', 'scored'];

function GateTable({ nowMs }: { nowMs: number }) {
  const rows = useMemo(() => {
    const w = (name: string, opens: number, closes: number, override: EventConfig['override'], revealed = false) => ({
      name,
      cfg: mockEventConfig({ opensAt: ts(opens), closesAt: ts(closes), override, winnerRevealed: revealed }),
    });
    return [
      w('before opensAt (opens +2h)', nowMs + 2 * HOUR, nowMs + 5 * HOUR, 'none'),
      w('inside window', nowMs - HOUR, nowMs + 2 * HOUR, 'none'),
      w('after closesAt (closed -1h)', nowMs - 5 * HOUR, nowMs - HOUR, 'none'),
      w('before opensAt + override open', nowMs + 2 * HOUR, nowMs + 5 * HOUR, 'open'),
      w('inside window + override closed', nowMs - HOUR, nowMs + 2 * HOUR, 'closed'),
      w('after closesAt + override open', nowMs - 5 * HOUR, nowMs - HOUR, 'open'),
      w('winnerRevealed', nowMs - 5 * HOUR, nowMs - HOUR, 'none', true),
    ];
  }, [nowMs]);
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-line text-left font-mono text-[0.65rem] uppercase tracking-widest text-muted">
          <th className="py-1 pr-2 font-normal">case</th>
          <th className="py-1 pr-2 font-normal">deriveStatus</th>
          <th className="py-1 font-normal">gate variant</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ name, cfg }) => {
          const s = deriveStatus(cfg, nowMs);
          return (
            <tr key={name} className="border-b border-line/60">
              <td className="py-1 pr-2 text-ink">{name}</td>
              <td className="py-1 pr-2 font-mono text-muted">{s}</td>
              <td className="py-1 font-mono text-muted">{quizGateVariant(s)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function QuizPanel({ nowMs }: PanelProps) {
  const config = useMemo(() => mockEventConfig({ opensAt: ts(nowMs - 2 * HOUR), closesAt: ts(nowMs + 90 * MIN) }), [nowMs]);
  const total = config.questions.length;
  const [answers, setAnswers] = useState<PickMap>({});
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<DerivedStatus>('open');
  const [revealed, setRevealed] = useState(0);
  const picks: PickMap = Object.fromEntries(config.questions.map((q, i) => [q.id, (q.kind === 'team' ? config.teams : config.drivers)[i].id]));
  const ticks = Object.fromEntries(config.questions.map((q, i) => [q.id, i % 2 === 0]));
  const ranked = mockRanked();

  return (
    <Grid>
      <Case title="Quiz" note={`All ${total} steps, the review step, submit and edit. Submit here only flips a local flag.`} wide>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <LabButton onClick={() => { setAnswers({}); setStep(0); setSubmitted(false); }}>Reset</LabButton>
          <LabButton onClick={() => { setAnswers(picks); setStep(total); setSubmitted(false); }}>Fill and jump to review</LabButton>
          <span className="font-mono text-[0.65rem] text-muted">step {step} · {Object.keys(answers).length}/{total} answered{submitted ? ' · submitted' : ''}</span>
        </div>
        <div className="max-w-xl">
          <Quiz config={config} answers={answers} step={step} submitting={false} error="" onAnswer={(q, id) => setAnswers((a) => ({ ...a, [q]: id }))} onStep={setStep} onSubmit={() => setSubmitted(true)} />
        </div>
      </Case>

      <Case title="QuizBanner" note="One banner per derived status; the gate decides banner, minimal line or nothing.">
        <Pick label="Status" value={status} options={STATUSES.map((s) => ({ id: s, label: `${s} (${quizGateVariant(s)})` }))} onChange={setStatus} />
        <div className="mt-3">
          <QuizBanner event={config} status={status} onReveal={() => setRevealed((n) => n + 1)} />
          <p className="mt-2 font-mono text-[0.65rem] text-muted">onReveal called {revealed}x</p>
        </div>
      </Case>

      <Case title="PicksCard" note="Locked picks, then with edit buttons, then with result ticks.">
        <div className="grid gap-3">
          <PicksCard config={config} answers={picks} title="Your picks" />
          <PicksCard config={config} answers={picks} title="Editable" onEdit={() => {}} />
          <PicksCard config={config} answers={picks} title="Scored" ticks={ticks} />
        </div>
      </Case>

      <Case title="CloseTimer" note="90 minutes, 45 seconds, already closed.">
        <div className="grid gap-2 text-xs text-ink">
          <CloseTimer closesAt={nowMs + 90 * MIN} />
          <CloseTimer closesAt={nowMs + 45_000} />
          <CloseTimer closesAt={nowMs - MIN} />
        </div>
      </Case>

      <Case title="Quiz gate" note="deriveStatus x quizGateVariant at the lab clock." wide>
        <GateTable nowMs={nowMs} />
      </Case>

      <Case title="Scoring result" note={`Top 5 of mockRanked(), max score ${mockMaxScore()}.`}>
        <ol className="grid gap-1 text-xs">
          {ranked.slice(0, 5).map((r) => (
            <li key={r.uid} className="flex justify-between border-b border-line/60 py-1">
              <span className="text-ink">{r.rank}. {r.name}</span>
              <span className="font-mono text-muted">{r.score}</span>
            </li>
          ))}
        </ol>
      </Case>
    </Grid>
  );
}
