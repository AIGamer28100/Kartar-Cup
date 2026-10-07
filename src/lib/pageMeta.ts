import { useEffect } from 'react';

export const SITE_NAME = 'Kartar CUP';
export const DEFAULT_DESCRIPTION =
  'Race watch parties, karting events and tickets from Kartar CUP, built around The Karter Cup community.';
const MAX_DESCRIPTION = 160;

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
}

/** Pure: "Page | Kartar CUP", or just the site name when there is no (or a redundant) page title. */
export function buildTitle(title?: string): string {
  const t = title?.trim();
  if (!t || t.toLowerCase() === SITE_NAME.toLowerCase()) return SITE_NAME;
  return `${t} | ${SITE_NAME}`;
}

/** Pure: collapses whitespace, falls back to the default, truncates to 160 chars on a word boundary. */
export function buildDescription(description?: string): string {
  const d = description?.replace(/\s+/g, ' ').trim();
  if (!d) return DEFAULT_DESCRIPTION;
  if (d.length <= MAX_DESCRIPTION) return d;
  const cut = d.slice(0, MAX_DESCRIPTION - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 80 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/** Client-side title/description/OG/Twitter tags. Restores the defaults on unmount. Crawlers that
 * do not run JS only ever see index.html's defaults (SPA limit; per-event cards need prerendering). */
export function usePageMeta({ title, description, image }: PageMeta): void {
  useEffect(() => {
    const t = buildTitle(title);
    const d = buildDescription(description);
    document.title = t;
    setMeta('name', 'description', d);
    setMeta('property', 'og:title', t);
    setMeta('property', 'og:description', d);
    setMeta('name', 'twitter:title', t);
    setMeta('name', 'twitter:description', d);
    if (image) {
      setMeta('property', 'og:image', image);
      setMeta('name', 'twitter:image', image);
    }
    return () => {
      document.title = SITE_NAME;
      setMeta('name', 'description', DEFAULT_DESCRIPTION);
      setMeta('property', 'og:title', SITE_NAME);
      setMeta('property', 'og:description', DEFAULT_DESCRIPTION);
      setMeta('name', 'twitter:title', SITE_NAME);
      setMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
    };
  }, [title, description, image]);
}
