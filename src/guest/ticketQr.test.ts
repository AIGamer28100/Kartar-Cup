import { vi } from 'vitest';

// Importing the component module pulls in firebase init, which needs real env keys; stub it.
vi.mock('../lib/firebase', () => ({ auth: {}, db: {}, signInGoogle: () => {} }));
import { describe, expect, it } from 'vitest';
import { ticketQrPayload } from './TicketView';

describe('ticketQrPayload (R58: QR is the secret qrToken only)', () => {
  it('encodes the qrToken, never the booking id', () => {
    const p = ticketQrPayload({ id: 'booking-123', qrToken: 'SecretTok32' });
    expect(p).toBe('SecretTok32');
    expect(p).not.toContain('booking-123');
  });

  it.each([undefined, null, '', '   '])('has no QR (null) for token %j, with no id fallback', (qrToken) => {
    expect(ticketQrPayload({ id: 'booking-123', qrToken })).toBeNull();
  });

  it('returns the token untrimmed when it has content', () => {
    expect(ticketQrPayload({ id: 'x', qrToken: ' abc ' })).toBe(' abc ');
  });
});
