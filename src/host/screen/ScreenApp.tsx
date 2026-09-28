import { useCallback, useEffect, useRef, useState } from 'react';
import FailurePage from '../../components/FailurePage';
import { setScreenState } from '../../lib/db';
import type { ScreenMode } from '../../lib/types';
import { useScreenData } from './useScreenData';
import { buildPodium, clampStage, nextStage, prevStage, type Stage } from './podium';
import LobbyScreen from './LobbyScreen';
import StandingsScreen from './StandingsScreen';
import PodiumScreen from './PodiumScreen';

function Skel() {
  return (
    <div aria-busy="true" role="status" className="flex min-h-[100dvh] flex-col items-center justify-center gap-6">
      <span className="sr-only">Loading</span>
      <div className="h-16 w-[min(80vw,40rem)] animate-pulse rounded-lg bg-raised" />
      <div className="h-10 w-[min(60vw,24rem)] animate-pulse rounded-lg bg-raised" />
    </div>
  );
}

const MODE_KEYS: Record<string, ScreenMode> = { '1': 'lobby', '2': 'standings', '3': 'podium' };

/** Full-viewport, host-controlled big-screen display. This IS the R20 exception inside
 * src/host/**: the one route that gets the high public-facing motion budget, because it's the
 * thing the whole room is looking at, not an internal tool. */
export default function ScreenApp() {
  const { loading, error, eventId, config, ranked, screenState, entryCount } = useScreenData();
  const [hintVisible, setHintVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = useCallback(
    (p: Parameters<typeof setScreenState>[1]) => {
      if (!eventId) return;
      void setScreenState(eventId, p);
    },
    [eventId],
  );

  const goStage = useCallback((s: Stage) => patch({ stage: s, mode: 'podium' }), [patch]);
  const goMode = useCallback((m: ScreenMode) => patch({ mode: m }), [patch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.code === 'Space' || e.key === 'ArrowRight') {
        e.preventDefault();
        goStage(nextStage(screenState.stage as Stage));
      } else if (e.key === 'ArrowLeft') {
        goStage(prevStage(screenState.stage as Stage));
      } else if (e.key.toLowerCase() === 'r') {
        goStage(0);
      } else if (e.key in MODE_KEYS) {
        goMode(MODE_KEYS[e.key]);
      } else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screenState.stage, goStage, goMode]);

  useEffect(() => {
    function onMove() {
      setHintVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setHintVisible(false), 3000);
    }
    window.addEventListener('mousemove', onMove);
    onMove();
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (loading) return <Skel />;
  if (error) return <FailurePage error={error} />;
  if (!eventId || !config) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-8 text-center">
        <p className="text-[clamp(1.25rem,3vw,2.5rem)] text-muted">No live event right now.</p>
      </div>
    );
  }

  const { p1, p2, p3 } = buildPodium(ranked);
  const stage = clampStage(screenState.stage);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-base text-ink">
      {screenState.mode === 'lobby' && <LobbyScreen config={config} entryCount={entryCount} />}
      {screenState.mode === 'standings' && <StandingsScreen config={config} ranked={ranked} />}
      {screenState.mode === 'podium' && (
        <PodiumScreen p1={p1} p2={p2} p3={p3} stage={stage} totalQuestions={config.questionIds.length} />
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-2 border-t border-line bg-base/90 px-4 py-2 backdrop-blur transition-opacity duration-300 ${
          hintVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        role="toolbar"
        aria-label="Screen controls"
      >
        <button
          type="button"
          aria-label="Lobby mode (key 1)"
          onClick={() => goMode('lobby')}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          1 Lobby
        </button>
        <button
          type="button"
          aria-label="Standings mode (key 2)"
          onClick={() => goMode('standings')}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          2 Standings
        </button>
        <button
          type="button"
          aria-label="Podium mode (key 3)"
          onClick={() => goMode('podium')}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          3 Podium
        </button>
        <button
          type="button"
          aria-label="Back a stage (left arrow)"
          onClick={() => goStage(prevStage(stage))}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          ← Back
        </button>
        <button
          type="button"
          aria-label="Next stage (space or right arrow)"
          onClick={() => goStage(nextStage(stage))}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          Next →
        </button>
        <button
          type="button"
          aria-label="Reset to sealed grid (key r)"
          onClick={() => goStage(0)}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          Reset
        </button>
        <button
          type="button"
          aria-label="Toggle fullscreen (key f)"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen().catch(() => {});
          }}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
}
