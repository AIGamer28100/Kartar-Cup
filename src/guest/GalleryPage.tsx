import Divider from '../components/Divider';
import { usePageMeta } from '../lib/pageMeta';
import { GALLERY_PLACEHOLDERS, gallerySrc } from './galleryData';
import { Eyebrow, PageTitle, Reveal, Shell } from './parts';

/** Public /gallery — moved out of the home page (R29 follow-up) so the past-events strip gets its
 * own page, mirroring /events. Same horizontal-scroll pattern as the home page's gallery section:
 * native overflow-x + CSS scroll-snap, no JS drag library, asymmetric card widths. Placeholder
 * images only (R26/R27) until real Karter Cup photos are supplied. */
export default function GalleryPage() {
  usePageMeta({ title: 'Gallery', description: 'Photos from past Karter Cup and Karter Club events.' });
  return (
    <Shell>
      <div className="max-w-[52ch]">
        <Reveal>
          <Eyebrow>Past events</Eyebrow>
          <h1 className={`mt-3 ${PageTitle}`}>Gallery</h1>
          <p className="mt-4 text-muted md:text-lg">
            Placeholder images for now — real event photos from The Karter Cup and The Karter Club
            will be swapped in here once they&rsquo;re supplied.
          </p>
        </Reveal>
      </div>

      <Divider className="mt-10" />

      <Reveal index={1} className="mt-8">
        <div
          className="scroll-hide -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:-mx-10 md:px-10 lg:-mx-16 lg:px-16"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {GALLERY_PLACEHOLDERS.map((g, i) => {
            const tall = i % 3 === 1;
            return (
              <figure
                key={g.seed}
                className={`m-0 shrink-0 snap-start ${tall ? 'w-[68vw] sm:w-[38vw] md:w-[26vw]' : 'w-[58vw] sm:w-[30vw] md:w-[20vw]'}`}
              >
                <img
                  src={gallerySrc(g.seed, tall ? 480 : 600, tall ? 600 : 420)}
                  alt={g.caption}
                  loading="lazy"
                  className={`w-full rounded-lg border border-line object-cover ${tall ? 'aspect-[4/5]' : 'aspect-[3/2]'}`}
                />
                <figcaption className="sr-only">{g.caption}</figcaption>
              </figure>
            );
          })}
        </div>
      </Reveal>
      <p className="mt-2 text-xs text-muted md:hidden" aria-hidden="true">
        Swipe to browse
      </p>
    </Shell>
  );
}
