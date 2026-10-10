/** Driver portraits. The F1 media CDN serves one portrait at any width (`.transform/Ncol`, roughly 109px
 * per col, up to ~1300px). OpenF1's headshot_url is always the 1col one (93px), which is soft even at
 * avatar size on a high-density screen, so every place that shows a face asks for a rendition sized to
 * its tile: 5col (545px, ~85KB) for a large portrait, 2col (206px, ~15KB) for a small one. A URL that is
 * not in the `.transform/1col/` shape is used as given. Images are hot-linked, never re-hosted. */
export function portraitUrl(url: string | null | undefined, cols: number): string | null {
  return url ? url.replace('.transform/1col/', `.transform/${cols}col/`) : null;
}
