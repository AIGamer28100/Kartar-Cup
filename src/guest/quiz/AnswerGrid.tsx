import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from '@phosphor-icons/react';
import { SPRING } from '../../lib/motion';
import { columnsOf, digitIndex, gridMove, type AnswerCard } from './grid';
import Tile from './Tile';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

/**
 * The answer cards for one call as a radio group. Roving tabindex + arrow/Home/End movement, and the digits 1-9
 * quick-pick (not while typing in the search box). One card is selected; the rest dim.
 */
export default function AnswerGrid({
  cards,
  value,
  onPick,
  labelledBy,
}: {
  cards: AnswerCard[];
  value: string | undefined;
  onPick: (id: string) => void;
  labelledBy: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = cards.findIndex((c) => c.id === value);
  const [focusIdx, setFocusIdx] = useState(selected >= 0 ? selected : 0);
  const tabIdx = Math.min(Math.max(focusIdx, 0), Math.max(cards.length - 1, 0));
  const yesno = cards[0]?.kind === 'yesno';
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      const i = digitIndex(e.key, cards.length);
      if (i === null) return;
      e.preventDefault();
      setFocusIdx(i);
      refs.current[i]?.focus();
      pickRef.current(cards[i].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cards]);

  const onKeyDown = (e: KeyboardEvent) => {
    const cols = columnsOf(refs.current.slice(0, cards.length).map((el) => el?.offsetTop ?? 0));
    const n = gridMove(tabIdx, e.key, cards.length, cols);
    if (n === null) return;
    e.preventDefault();
    setFocusIdx(n);
    refs.current[n]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={`grid gap-2 sm:gap-3 ${yesno ? 'grid-cols-2 lg:max-w-xl' : 'grid-cols-2 md:grid-cols-3 2xl:grid-cols-4'}`}
    >
      {cards.map((c, i) => (
        <Card
          key={c.id}
          card={c}
          index={i}
          selected={c.id === value}
          dim={!!value && c.id !== value}
          tabIndex={i === tabIdx ? 0 : -1}
          onFocus={() => setFocusIdx(i)}
          onPick={() => onPick(c.id)}
          refFn={(el) => {
            refs.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

function Card({
  card: c,
  index,
  selected,
  dim,
  tabIndex,
  onFocus,
  onPick,
  refFn,
}: {
  card: AnswerCard;
  index: number;
  selected: boolean;
  dim: boolean;
  tabIndex: number;
  onFocus: () => void;
  onPick: () => void;
  refFn: (el: HTMLButtonElement | null) => void;
}) {
  const reduce = useReducedMotion();
  const yesno = c.kind === 'yesno';
  const ring = yesno ? 'var(--color-accent)' : c.colour;
  const key = index < 9 ? String(index + 1) : null;
  const bg = yesno
    ? selected
      ? 'var(--color-accent)'
      : 'var(--color-raised)'
    : `linear-gradient(110deg, color-mix(in srgb, ${c.colour} ${selected ? 46 : 30}%, var(--color-raised)), var(--color-raised) 78%)`;
  return (
    <motion.button
      ref={refFn}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={onPick}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      animate={reduce ? { opacity: dim ? 0.6 : 1 } : { opacity: dim ? 0.6 : 1, scale: selected ? 1.02 : 1 }}
      transition={SPRING.snappy}
      className={`group relative flex w-full min-w-0 overflow-hidden rounded-xl border border-line text-left text-ink hover:border-muted ${focusRing} ${
        yesno ? 'min-h-28 items-center justify-center sm:min-h-36' : c.kind === 'team' ? 'min-h-16 items-stretch' : 'min-h-[4.75rem] items-stretch'
      }`}
      style={{ background: bg }}
    >
      {/* Selection ring in the team colour: scale/opacity only. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl border-2"
        style={{ borderColor: ring }}
        initial={false}
        animate={selected ? { opacity: 1, scale: 1 } : { opacity: 0, scale: reduce ? 1 : 1.06 }}
        transition={reduce ? { duration: 0 } : SPRING.pop}
      />
      {yesno ? (
        <span className={`text-4xl font-semibold tracking-tight sm:text-5xl ${selected ? 'text-accent-ink' : ''}`}>{c.label}</span>
      ) : (
        <>
          <Tile card={c} cols={2} className={c.kind === 'driver' ? 'w-12 sm:w-16' : 'w-11 sm:w-14'} />
          <span className="flex min-w-0 flex-1 flex-col justify-center py-2 pl-2.5 pr-7 sm:pl-3">
            {c.first && <span className="truncate text-xs text-muted">{c.first}</span>}
            <span className={`text-[0.9375rem] font-semibold leading-tight sm:text-lg ${c.kind === 'team' ? 'line-clamp-2 break-words' : 'truncate'}`}>{c.main}</span>
            {c.sub && <span className="truncate text-xs text-muted">{c.sub}</span>}
          </span>
        </>
      )}
      <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center" aria-hidden="true">
        {selected ? (
          <motion.span
            initial={!reduce && { scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING.pop}
            className={`flex size-6 items-center justify-center rounded-full ${yesno ? 'bg-accent-ink text-accent' : ''}`}
            style={yesno ? undefined : { background: c.colour, color: 'var(--color-base)' }}
          >
            <Check size={14} weight="bold" />
          </motion.span>
        ) : (
          key && <span className="hidden font-mono text-[0.65rem] text-muted pointer-fine:inline">{key}</span>
        )}
      </span>
    </motion.button>
  );
}
