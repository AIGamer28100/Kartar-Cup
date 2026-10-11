/**
 * Render smoke test for the Mock Lab: every panel plus MockLab itself must mount without throwing.
 * No JSX (vitest only picks up *.test.ts) and no new dependency: react-dom/server + createElement.
 * A broken panel fails CI instead of blanking the dev page.
 */
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BASE_MS } from '../fixtures';
import type { PanelProps } from './MockLab';

const NOW = BASE_MS;

/**
 * The suite runs in vitest's node environment (no jsdom in this repo, and adding one is not allowed),
 * so a server render has no `window`. A few real components read `window.location.origin` while
 * rendering, which is legitimate in the browser the lab actually runs in. Shim just that, nothing else,
 * and remove it again afterwards so no other test sees a half-browser global.
 */
const hadWindow = 'window' in globalThis;
beforeAll(() => {
  if (!hadWindow) {
    (globalThis as { window?: unknown }).window = {
      location: { origin: 'http://localhost:5173', href: 'http://localhost:5173/race-state-mock' },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  }
});
afterAll(() => {
  if (!hadWindow) delete (globalThis as { window?: unknown }).window;
});

const PANELS: { id: string; load: () => Promise<{ default: ComponentType<PanelProps> }> }[] = [
  { id: 'race-states', load: () => import('./panels/RaceStatesPanel') },
  { id: 'openf1', load: () => import('./panels/OpenF1Panel') },
  { id: 'quiz', load: () => import('./panels/QuizPanel') },
  { id: 'booking', load: () => import('./panels/BookingPanel') },
  { id: 'ticket', load: () => import('./panels/TicketPanel') },
  { id: 'cards', load: () => import('./panels/CardsPanel') },
  { id: 'results', load: () => import('./panels/ResultsPanel') },
  { id: 'previous-card', load: () => import('./panels/PreviousCardPanel') },
  { id: 'cup', load: () => import('./panels/CupPanel') },
  { id: 'screen', load: () => import('./panels/ScreenPanel') },
  { id: 'host', load: () => import('./panels/HostPanel') },
  { id: 'overlay', load: () => import('./panels/OverlayPanel') },
  { id: 'profile', load: () => import('./panels/ProfilePanel') },
  { id: 'motion', load: () => import('./panels/MotionPanel') },
  { id: 'coverage', load: () => import('./panels/CoveragePanel') },
];

describe('Mock Lab renders', () => {
  it('covers every tab declared in MockLab', async () => {
    const src = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./MockLab.tsx', import.meta.url), 'utf8'));
    const declared = [...src.matchAll(/\{ id: '([a-z0-9-]+)', label: '[^']+', hint:/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    expect(PANELS.map((p) => p.id).sort()).toEqual(declared.sort());
  });

  for (const p of PANELS) {
    it(`${p.id} panel mounts`, async () => {
      const Panel = (await p.load()).default;
      const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Panel, { nowMs: NOW })));
      expect(html.length).toBeGreaterThan(0);
    });
  }

  it('MockLab itself mounts', async () => {
    const Lab = (await import('./MockLab')).default;
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: ['/race-state-mock?tab=coverage'] }, createElement(Lab)),
    );
    expect(html).toContain('Mock Lab');
  });
});
