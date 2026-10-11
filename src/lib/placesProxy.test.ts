import { describe, expect, it } from 'vitest';
// @ts-expect-error plain-JS Worker module, no types
import { canRunBookings, verifyFirebaseIdToken } from '../../worker/places-proxy/src/verify.js';

const PROJECT = 'kartar-cup';
const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function makeToken(over: Record<string, unknown> = {}, signWith?: CryptoKeyPair) {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'u1', iat: now - 10, exp: now + 3600, ...over };
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', (signWith ?? pair).privateKey, new TextEncoder().encode(`${head}.${body}`));
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  return { token: `${head}.${body}.${b64u(sig)}`, jwks: { keys: [jwk] } };
}

describe('verifyFirebaseIdToken', () => {
  it('accepts a valid token', async () => {
    const { token, jwks } = await makeToken();
    await expect(verifyFirebaseIdToken(token, { projectId: PROJECT, jwks })).resolves.toMatchObject({ sub: 'u1' });
  });
  it('rejects a token signed by a different key', async () => {
    const { token } = await makeToken();
    const other = await makeToken();
    await expect(verifyFirebaseIdToken(token, { projectId: PROJECT, jwks: other.jwks })).rejects.toThrow('signature');
  });
  it('rejects wrong audience, issuer, expired, and malformed tokens', async () => {
    for (const over of [{ aud: 'other' }, { iss: 'https://evil' }, { exp: 1 }, { sub: '' }]) {
      const { token, jwks } = await makeToken(over);
      await expect(verifyFirebaseIdToken(token, { projectId: PROJECT, jwks })).rejects.toThrow('bad token');
    }
    await expect(verifyFirebaseIdToken('nope', { projectId: PROJECT, jwks: { keys: [] } })).rejects.toThrow('malformed');
  });
});

describe('canRunBookings', () => {
  const payload = { sub: 'u1', email: 'Host@x.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  const resp = (ok: boolean, body: unknown = {}) => ({ ok, json: async () => body }) as Response;
  it('allows the console super admin (hosts/{email} readable)', async () => {
    const fetchFn = async (u: string) => resp(u.includes('/hosts/host%40x.com'));
    await expect(canRunBookings(payload, 't', { projectId: PROJECT, fetchFn })).resolves.toBe(true);
  });
  it('allows host-control roles and rejects plain guests', async () => {
    const withRoles = (roles: string[]) => async (u: string) =>
      u.includes('/users/') ? resp(true, { fields: { roles: { arrayValue: { values: roles.map((stringValue) => ({ stringValue })) } } } }) : resp(false);
    for (const role of ['admin', 'host', 'venue_host']) {
      await expect(canRunBookings(payload, 't', { projectId: PROJECT, fetchFn: withRoles([role]) })).resolves.toBe(true);
    }
    await expect(canRunBookings(payload, 't', { projectId: PROJECT, fetchFn: withRoles(['guest']) })).resolves.toBe(false);
    await expect(canRunBookings(payload, 't', { projectId: PROJECT, fetchFn: async () => resp(false) })).resolves.toBe(false);
  });
  it('rejects unverified or non-Google sign-ins without calling Firestore', async () => {
    const fetchFn = async () => { throw new Error('should not be called'); };
    await expect(canRunBookings({ ...payload, email_verified: false }, 't', { projectId: PROJECT, fetchFn })).resolves.toBe(false);
    await expect(canRunBookings({ ...payload, firebase: { sign_in_provider: 'password' } }, 't', { projectId: PROJECT, fetchFn })).resolves.toBe(false);
  });
});
