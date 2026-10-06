import { Link } from 'react-router';
import Divider from '../components/Divider';
import { usePageMeta } from '../lib/pageMeta';
import { Eyebrow, H3, PageTitle, Reveal, Shell } from './parts';

/** Public /about. Facts come only from docs/research/instagram-brand-facts.md and rule R25;
 * no stats, no sponsor names (R26), no claims beyond what the real accounts say about themselves. */
export default function AboutPage() {
  usePageMeta({
    title: 'About',
    description: 'Kartar CUP is the booking and watch-party site for The Karter Cup, a motorsport events and community, and The Karter Club.',
  });
  return (
    <Shell>
      <div className="max-w-[60ch]">
        <Reveal>
          <Eyebrow>About</Eyebrow>
          <h1 className={`mt-3 ${PageTitle}`}>The Karter Cup and The Karter Club</h1>
          <p className="mt-4 text-muted md:text-lg">
            The Karter Cup is a motorsport events and community: karting events, sim racing and
            watch parties. It runs karting events in Chennai and Coimbatore.
          </p>
        </Reveal>
      </div>

      <Divider className="mt-10" />

      <div className="mt-8 grid max-w-[60ch] gap-8">
        <Reveal index={1}>
          <h2 className={H3}>The Karter Club</h2>
          <p className="mt-2 text-muted">
            The Karter Club is Chennai&rsquo;s F1 paddock community, an initiative by The Karter
            Cup. It is home to the watch parties, sim racing and community side of things.
          </p>
        </Reveal>
        <Reveal index={2}>
          <h2 className={H3}>This site</h2>
          <p className="mt-2 text-muted">
            Kartar CUP is where you find upcoming events, book tickets and, on race days, join the
            prediction quiz. Follow the real accounts for news and photos on the{' '}
            <Link to="/contact" className="text-ink underline underline-offset-4 hover:text-accent-text">
              contact page
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </Shell>
  );
}
