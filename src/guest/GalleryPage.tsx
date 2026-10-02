import { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import Divider from '../components/Divider';
import { usePageMeta } from '../lib/pageMeta';
import { GALLERY_PLACEHOLDERS, gallerySrc, type GalleryPlaceholder } from './galleryData';
import { Eyebrow, PageTitle, Reveal, Shell } from './parts';

/** Visible caption: the data's "Placeholder — " prefix is already stated once in the page intro. */
const captionText = (g: GalleryPlaceholder): string => {
  const t = g.caption.replace(/^Placeholder\s+[—-]\s+/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Tap-to-expand viewer on a native <dialog>: showModal() gives the focus trap, Esc to close and
 * inert background for free; backdrop click closes; focus returns to the tapped thumbnail. */
function Lightbox({ item, onClose }: { item: GalleryPlaceholder | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item && !d.open) d.showModal();
    if (!item && d.open) d.close();
  }, [item]);
  return (
    <dialog
      ref={ref}
      aria-label={item ? captionText(item) : 'Photo'}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(92vw,64rem)] overflow-hidden rounded-lg border border-line bg-base p-0 text-ink backdrop:bg-black/80"
    >
      {item && (
        <figure className="relative m-0">
          <img
            src={gallerySrc(item.seed, 1200, 800)}
            alt={item.caption}
            className="block aspect-[3/2] max-h-[78dvh] w-full bg-raised object-cover"
          />
          <figcaption className="px-4 py-3 text-sm text-muted">{captionText(item)}</figcaption>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close photo"
            className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-lg bg-base/80 text-ink backdrop-blur transition hover:bg-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={22} weight="regular" aria-hidden="true" />
          </button>
        </figure>
      )}
    </dialog>
  );
}

/** Public /gallery: a calm, consistent grid (1 col phone / 2 tablet / 3 desktop), every tile a fixed
 * 3:2 box so lazy-loaded images never shift the layout, captions below, tap a tile to expand.
 * Placeholder images only (R26/R27) until real Karter Cup photos are supplied. */
export default function GalleryPage() {
  usePageMeta({ title: 'Gallery', description: 'Photos from past Karter Cup and Karter Club events.' });
  const [open, setOpen] = useState<GalleryPlaceholder | null>(null);
  return (
    <Shell>
      <div className="max-w-[52ch]">
        <Reveal>
          <Eyebrow>Past events</Eyebrow>
          <h1 className={`mt-3 ${PageTitle}`}>Gallery</h1>
          <p className="mt-4 text-muted md:text-lg">
            Placeholder images for now. Real event photos from The Karter Cup and The Karter Club
            will be swapped in here once they&rsquo;re supplied.
          </p>
        </Reveal>
      </div>

      <Divider className="mt-10" />

      <Reveal index={1} className="mt-8">
        <ul className="m-0 grid list-none grid-cols-1 gap-x-5 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_PLACEHOLDERS.map((g) => (
            <li key={g.seed} className="min-w-0">
              <figure className="m-0">
                <button
                  type="button"
                  onClick={() => setOpen(g)}
                  aria-label={`Expand photo: ${captionText(g)}`}
                  className="group block w-full overflow-hidden rounded-lg border border-line bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <img
                    src={gallerySrc(g.seed, 720, 480)}
                    alt=""
                    width={720}
                    height={480}
                    loading="lazy"
                    className="block aspect-[3/2] w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                </button>
                <figcaption className="mt-3 text-sm text-muted">{captionText(g)}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>
      <Lightbox item={open} onClose={() => setOpen(null)} />
    </Shell>
  );
}
