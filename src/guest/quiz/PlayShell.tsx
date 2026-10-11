import type { ReactNode } from 'react';

/** The game frame around every /play screen: brand mark, an optional HUD pill on the right, then the page. */
export default function PlayShell({ children, hud }: { children: ReactNode; hud?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[87.5rem] flex-col px-4 pt-3 sm:px-6 md:px-10 md:pt-5 lg:px-16">
      <header className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 md:mb-8">
        <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
          <span className="size-2 shrink-0 rounded-full bg-accent shadow-[0_0_10px_1px_rgb(216_30_54/0.6)]" aria-hidden="true" />
          Kartar CUP
          <span className="hidden font-mono text-[0.65rem] font-normal uppercase tracking-widest text-muted sm:inline">Race predictor</span>
        </p>
        {hud}
      </header>
      <main className="flex min-w-0 flex-1 flex-col pb-8">{children}</main>
    </div>
  );
}
