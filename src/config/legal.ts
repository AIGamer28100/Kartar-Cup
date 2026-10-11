/* Legal identity shown in the footer, /terms and /privacy.
 *
 * DEVELOPER (fixed): aigamer.dev built the software and owns its copyright. The developer does not run the
 * site, hosts nothing, and decides nothing about users' data.
 *
 * OPERATOR (must be filled in by the club BEFORE launch): the legal person that runs this site, owns the
 * Firebase/hosting accounts, is the party users deal with, and is responsible for the data, events, prizes,
 * payments and compliance. Leave a value empty and the pages show a clearly marked "operator to complete"
 * line instead of inventing details (R26). Have a lawyer review the pages before the site takes real
 * bookings: these texts are a drafting aid, not legal advice. */

export const DEVELOPER = {
  name: 'aigamer.dev',
  year: 2026,
} as const;

export const OPERATOR = {
  /** Legal name, e.g. "The Karter Cup" / the registered entity or the individual who runs it. */
  legalName: '',
  /** Short public name used in sentences. */
  shortName: 'The Karter Cup',
  /** Registered or postal address. */
  address: '',
  /** Contact email for users (privacy requests, support). */
  email: '',
  /** Phone or WhatsApp, optional. */
  phone: '',
  /** Name and contact of the person who handles privacy complaints (India's DPDP Act and IT Rules expect one). */
  grievanceOfficer: '',
  /** Court location for disputes; operator to confirm with their lawyer. */
  jurisdiction: 'Chennai, Tamil Nadu, India',
  /** Date these texts were last reviewed by the operator. */
  lastReviewed: '2026-10-03',
} as const;

/** True when the operator has not yet supplied a field. */
export const missing = (v: string): boolean => v.trim().length === 0;
