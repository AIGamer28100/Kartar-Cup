import { WHATSAPP_COMMUNITY_URL } from './event';
/** Contact details shown on /contact. Only the Instagram handles are real (see
 * docs/research/instagram-brand-facts.md). Empty strings are rendered as "host fills this in"
 * placeholders; never put invented values here. */
export const CONTACT = {
    instagram: [
        { handle: '@thekartercup', url: 'https://www.instagram.com/thekartercup/', role: 'The Karter Cup: karting events, sim racing and the wider community' },
        { handle: '@thekarterclub', url: 'https://www.instagram.com/thekarterclub/', role: 'The Karter Club: watch parties and the F1 paddock community' },
    ],
    whatsappUrl: WHATSAPP_COMMUNITY_URL,
    email: '',
    phone: '',
};
