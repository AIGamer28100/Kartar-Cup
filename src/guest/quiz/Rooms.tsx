import { motion, useReducedMotion } from 'framer-motion';
import Skeleton, { Busy } from '../../components/Skeleton';
import StatusDot from '../../components/StatusDot';
import { SPRING } from '../../lib/motion';
import { maxScore } from '../../lib/scoring';
import type { EventConfig } from '../../lib/types';
import type { PickMap } from '../draft';
import { istReadout } from '../model';
import { Eyebrow, Reveal, Split, TickStrip, WhatsAppCta } from '../parts';
import PicksCard from '../PicksCard';
import { RoundTimeline } from './Facts';
import { SCORING_NOTE, closeLapOf, delayedHold, lapLine } from './logic';
import PlayShell from './PlayShell';
import { ClosePill } from './RaceClock';
import { LightsOut } from './StartLights';

/** "Now lap 4 / 52 ..." / "After lap 16" / "13:27 IST" / "Not before lights out (race delayed)" for the timeline. */
export function closesLabel(config: EventConfig): string {
  if (delayedHold(config)) return 'Not before lights out (race delayed)';
  const laps = lapLine(config);
  if (laps) return laps.replace(/^Lap/, 'Now lap');
  if (typeof config.totalLaps === 'number' && config.totalLaps > 0) return `After lap ${closeLapOf(Math.floor(config.totalLaps))}`;
  return `${istReadout(config.closesAt.toMillis()).time} IST`;
}

/** Locked in, window still open: the waiting room. Lights-out moment and the guest's own grid. Picks are final (R68). */
export function WaitingRoom({ config, answers, name, pending }: { config: EventConfig; answers: PickMap; name: string; pending: boolean }) {
  return (
    <PlayShell hud={<ClosePill config={config} />}>
      <Split
        left={
          <>
            <LightsOut>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Waiting room</p>
              <h1 className="mt-2 text-h2 font-semibold text-balance" role="status">
                {pending ? 'Sending your picks' : 'Picks locked in'}
              </h1>
              <p className="mt-3 max-w-[40ch] text-pretty text-muted md:text-lg">
                {pending ? 'Hold on while the signal gets through to race control.' : `Copy that, ${name}. Your picks are locked and cannot be changed.`}
              </p>
            </LightsOut>
            <div className="mt-8">
              <RoundTimeline stage="locked" closesLabel={closesLabel(config)} />
            </div>
            <p className="mt-6 max-w-[40ch] text-pretty text-sm text-muted">{SCORING_NOTE}</p>
            <div className="mt-6 flex flex-col items-start gap-3">
              <WhatsAppCta url={config.whatsappUrl} />
            </div>
          </>
        }
        right={
          <Reveal index={1}>
            <PicksCard config={config} answers={answers} title="Your grid" />
          </Reveal>
        }
      />
    </PlayShell>
  );
}

/** Pit lane closed: no more changes; scoring comes after the race. */
export function ClosedRoom({ config, answers }: { config: EventConfig; answers: PickMap | null }) {
  return (
    <PlayShell
      hud={
        <p className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-raised px-3 font-mono text-xs uppercase tracking-widest text-muted">
          <StatusDot status="locked" /> Closed
        </p>
      }
    >
      <Split
        left={
          <>
            <Reveal>
              <Eyebrow>{config.name}</Eyebrow>
              <h1 className="mt-3 text-h2 font-semibold text-balance">Pit lane closed</h1>
              <p className="mt-3 max-w-[40ch] text-pretty text-muted md:text-lg">
                {answers
                  ? 'No more changes. Your grid is in. Now watch the race and shout at the screen.'
                  : 'You did not lock in any picks this round. Enjoy the race, and be quicker off the line next time.'}
              </p>
            </Reveal>
            {answers && (
              <Reveal index={1} className="mt-8">
                <RoundTimeline stage="closed" closesLabel={closesLabel(config)} />
                <p className="mt-6 max-w-[40ch] text-pretty text-sm text-muted">{SCORING_NOTE}</p>
              </Reveal>
            )}
            <Reveal index={2} className="mt-6">
              <WhatsAppCta url={config.whatsappUrl} />
            </Reveal>
          </>
        }
        right={
          answers ? (
            <Reveal index={1}>
              <PicksCard config={config} answers={answers} title="Your grid" />
            </Reveal>
          ) : undefined
        }
      />
    </PlayShell>
  );
}

/** Chequered flag: the guest's own score (picks + Play-card bonus, R46) and their ticks. */
export function ScoredRoom({
  config,
  name,
  answers,
  score,
  cardBonus,
}: {
  config: EventConfig;
  name: string;
  answers: PickMap | null;
  score: { score: number; ticks: Record<string, boolean> } | null;
  cardBonus: number;
}) {
  const reduce = useReducedMotion();
  const hud = (
    <p className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-raised px-3 font-mono text-xs uppercase tracking-widest text-ink">
      <span className="podium-chequer size-3 rounded-sm" aria-hidden="true" />
      Final
    </p>
  );
  if (!answers) {
    return (
      <PlayShell hud={hud}>
        <Split
          left={
            <Reveal>
              <Eyebrow>Chequered flag</Eyebrow>
              <h1 className="mt-3 text-h2 font-semibold text-balance">Results are in</h1>
              <p className="mt-3 max-w-[40ch] text-pretty text-muted md:text-lg">You did not enter this round. Catch the standings on the big screen.</p>
            </Reveal>
          }
          right={
            <Reveal index={1}>
              <WhatsAppCta url={config.whatsappUrl} />
            </Reveal>
          }
        />
      </PlayShell>
    );
  }
  return (
    <PlayShell hud={hud}>
      <Split
        left={
          <>
            <Reveal>
              <Eyebrow>Chequered flag</Eyebrow>
              <h1 className="mt-3 text-h2 font-semibold text-balance">{name}, your result</h1>
            </Reveal>
            <Reveal index={1} className="mt-6">
              {score ? (
                <>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">Your score</p>
                  <motion.p
                    initial={!reduce && { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={SPRING.pop}
                    className="origin-left font-num text-[clamp(5rem,13vw,11rem)] font-extrabold italic tabular-nums leading-none text-gold"
                  >
                    {score.score + cardBonus}
                    <span className="text-[0.4em] text-muted"> / {maxScore(config.questions) + cardBonus}</span>
                  </motion.p>
                  {cardBonus > 0 && (
                    <p className="mt-2 font-mono text-sm tabular-nums text-muted">
                      {score.score} from picks + {cardBonus} from your Play card
                    </p>
                  )}
                  <div className="mt-6">
                    <TickStrip config={config} ticks={score.ticks} />
                  </div>
                  <p className="mt-4 max-w-[40ch] text-sm text-muted">Scored from the official race classification.</p>
                </>
              ) : (
                <Busy className="flex flex-col gap-3">
                  <Skeleton variant="shimmer" className="h-16 w-40" />
                  <Skeleton variant="shimmer" className="h-11 w-full" />
                </Busy>
              )}
            </Reveal>
            <Reveal index={3} className="mt-8">
              <WhatsAppCta url={config.whatsappUrl} />
            </Reveal>
          </>
        }
        right={
          <Reveal index={2}>
            <PicksCard config={config} answers={answers} title="Your grid" ticks={score?.ticks} />
          </Reveal>
        }
      />
    </PlayShell>
  );
}
