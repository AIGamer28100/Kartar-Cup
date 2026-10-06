import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  PARTNER_KINDS,
  partnerKindLabel,
  storyTagLabel,
  watchPublishedPartners,
  watchPublishedStories,
  type Partner,
  type Story,
} from '../lib/content';
import { usePageMeta } from '../lib/pageMeta';
import { Eyebrow, H3, PageTitle, Reveal, Shell } from './parts';

/* /partners and /stories(/:id). Public, read-only, and driven entirely by what the host enters in
 * Host > Content (R26/R27: no seed or invented names, logos or posts). Empty states say so honestly. */

const mono = 'font-mono tabular-nums';
const dateFmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

function usePublished<T>(watch: (cb: (v: T[]) => void, onErr?: (e: Error) => void) => () => void) {
  const [items, setItems] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => watch(setItems, () => setFailed(true)), [watch]);
  return { items, failed };
}

function Cover({ url }: { url?: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return null;
  return <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="aspect-[3/2] w-full rounded-lg border border-line object-cover" />;
}

/* ---------------- partners ---------------- */

function PartnerCard({ p }: { p: Partner }) {
  const [broken, setBroken] = useState(false);
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex h-14 items-center">
        {p.logoUrl && !broken ? (
          <img src={p.logoUrl} alt={`${p.name} logo`} loading="lazy" onError={() => setBroken(true)} className="max-h-14 w-auto max-w-[70%] object-contain" />
        ) : (
          <span className="text-lg font-semibold">{p.name}</span>
        )}
      </div>
      {p.logoUrl && !broken && <h3 className="font-medium">{p.name}</h3>}
      <span className="w-fit rounded-full border border-line px-2.5 font-mono text-xs uppercase tracking-widest text-muted">{partnerKindLabel(p.kind)}</span>
      {p.blurb && <p className="text-pretty text-sm text-muted">{p.blurb}</p>}
      {p.website && (
        <a href={p.website} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-11 items-center text-sm text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
          Visit website<span className="sr-only"> for {p.name} (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}

export function PartnersPage() {
  usePageMeta({ title: 'Partners', description: 'The sponsors, venues and community partners behind Kartar CUP events.' });
  const { items, failed } = usePublished<Partner>(watchPublishedPartners);
  return (
    <Shell>
      <Reveal>
        <Eyebrow>Partners</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>The people behind the events</h1>
        <p className="mt-3 max-w-[60ch] text-pretty text-muted">Sponsors, venues and community partners who help us put events on.</p>
      </Reveal>
      <Reveal index={1} className="mt-8">
        {failed && <p role="alert" className="text-accent-text">We could not load the partners right now. Try again in a moment.</p>}
        {!failed && items === null && <p role="status" className="text-muted">Loading partners...</p>}
        {items && items.length === 0 && <p className="text-muted">Our partners will appear here once they are announced.</p>}
        {items && items.length > 0 && (
          <div className="grid gap-8">
            {PARTNER_KINDS.map((k) => {
              const group = items.filter((p) => p.kind === k.id);
              return group.length === 0 ? null : (
                <section key={k.id} aria-labelledby={`pk-${k.id}`}>
                  <h2 id={`pk-${k.id}`} className={H3}>{k.label}s</h2>
                  <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.map((p) => (
                      <PartnerCard key={p.id} p={p} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Reveal>
    </Shell>
  );
}

/* ---------------- stories ---------------- */

function StoryCard({ s }: { s: Story }) {
  return (
    <li className="group relative flex min-w-0 flex-col gap-3 rounded-lg border border-line p-4 transition-colors hover:border-accent">
      <Cover url={s.coverUrl} />
      <p className={`${mono} text-xs uppercase tracking-widest text-muted`}>
        {storyTagLabel(s.tag)} - {dateFmt(s.date)}
      </p>
      <h2 className={H3}>
        <Link to={`/stories/${s.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {s.title}
        </Link>
      </h2>
      {s.summary && <p className="text-pretty text-sm text-muted">{s.summary}</p>}
    </li>
  );
}

export function StoriesPage() {
  const { storyId } = useParams();
  const { items, failed } = usePublished<Story>(watchPublishedStories);
  const story = storyId && items ? items.find((s) => s.id === storyId) : undefined;
  usePageMeta({
    title: story ? story.title : 'Stories',
    description: story?.summary || 'Race recaps, event stories and news from the Kartar CUP community.',
  });

  if (storyId) {
    return (
      <Shell>
        <Reveal>
          <Link to="/stories" className="inline-flex min-h-11 items-center text-sm text-accent-text underline decoration-line underline-offset-4">All stories</Link>
          {failed && <p role="alert" className="mt-4 text-accent-text">We could not load this story right now.</p>}
          {!failed && items === null && <p role="status" className="mt-4 text-muted">Loading...</p>}
          {items && !story && <p className="mt-4 text-muted">We could not find that story. It may have been removed.</p>}
          {story && (
            <article className="mt-4 max-w-[68ch]">
              <p className={`${mono} text-xs uppercase tracking-widest text-muted`}>
                {storyTagLabel(story.tag)} - {dateFmt(story.date)}
              </p>
              <h1 className={`mt-3 ${PageTitle}`}>{story.title}</h1>
              {story.coverUrl && (
                <div className="mt-6">
                  <Cover url={story.coverUrl} />
                </div>
              )}
              <div className="mt-6 grid gap-4 text-pretty">
                {(story.body ?? story.summary ?? '')
                  .split(/\n{2,}/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i} className="whitespace-pre-line">{para}</p>
                  ))}
              </div>
            </article>
          )}
        </Reveal>
      </Shell>
    );
  }

  return (
    <Shell>
      <Reveal>
        <Eyebrow>Stories</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>From the paddock and the community</h1>
        <p className="mt-3 max-w-[60ch] text-pretty text-muted">Race recaps, event stories and news from Kartar CUP.</p>
      </Reveal>
      <Reveal index={1} className="mt-8">
        {failed && <p role="alert" className="text-accent-text">We could not load the stories right now. Try again in a moment.</p>}
        {!failed && items === null && <p role="status" className="text-muted">Loading stories...</p>}
        {items && items.length === 0 && <p className="text-muted">Our first stories will be posted here soon.</p>}
        {items && items.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <StoryCard key={s.id} s={s} />
            ))}
          </ul>
        )}
      </Reveal>
    </Shell>
  );
}
