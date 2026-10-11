/**
 * Past-events gallery data. Placeholder-only for now (picsum.photos/seed/{name}) — real Karter
 * Cup photos are not downloaded/rehosted (R27; docs/research/community-page-survey.md section D).
 * Swap this array for real Instagram oEmbed entries later; the section is driven entirely by it.
 */
export interface GalleryPlaceholder {
  seed: string;
  caption: string;
}

export const GALLERY_PLACEHOLDERS: GalleryPlaceholder[] = [
  { seed: 'karter-cup-ecr-1', caption: 'Placeholder — Chennai karting night at ECR Speedway' },
  { seed: 'karter-cup-watchparty-1', caption: 'Placeholder — a Karter Club watch-party crowd' },
  { seed: 'karter-cup-coimbatore-1', caption: 'Placeholder — Coimbatore karting day at Prime Kart Zone' },
  { seed: 'karter-cup-podium-1', caption: 'Placeholder — podium celebrations' },
  { seed: 'karter-cup-simrig-1', caption: 'Placeholder — sim racing rig setup' },
  { seed: 'karter-cup-grid-1', caption: 'Placeholder — drivers on the grid' },
];

export const gallerySrc = (seed: string, w: number, h: number): string =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;
