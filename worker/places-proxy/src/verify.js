// Firebase ID-token verification for a Cloudflare Worker (WebCrypto only, no dependencies).
// Spec: https://firebase.google.com/docs/auth/admin/verify-id-tokens (RS256, Google securetoken JWKS).

export const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const dec = new TextDecoder();

function b64uToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Verify signature + standard claims. Returns the payload, or throws Error('bad token: ...'). */
export async function verifyFirebaseIdToken(token, { projectId, jwks, nowSec = Math.floor(Date.now() / 1000) }) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new Error('bad token: malformed');
  let header;
  let payload;
  try {
    header = JSON.parse(dec.decode(b64uToBytes(parts[0])));
    payload = JSON.parse(dec.decode(b64uToBytes(parts[1])));
  } catch {
    throw new Error('bad token: malformed');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad token: alg');
  const jwk = (jwks?.keys ?? []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('bad token: unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64uToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new Error('bad token: signature');
  if (payload.aud !== projectId) throw new Error('bad token: aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad token: iss');
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) throw new Error('bad token: expired');
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) throw new Error('bad token: iat');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('bad token: sub');
  return payload;
}

const HOST_ROLES = ['admin', 'host', 'venue_host'];

/** Same people the Firestore rules call canRunBookings(): the console super admin (hosts/{email}) or a
 * user doc with the admin / host / venue_host role. Asks Firestore AS THE CALLER (their own ID token),
 * so the project's rules stay the single source of truth and the Worker needs no service account. */
export async function canRunBookings(payload, idToken, { projectId, fetchFn = fetch }) {
  const verifiedGoogle = payload.email_verified === true && payload.firebase?.sign_in_provider === 'google.com';
  if (!verifiedGoogle || typeof payload.email !== 'string') return false;
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${idToken}` };

  const superAdmin = await fetchFn(`${base}/hosts/${encodeURIComponent(payload.email.toLowerCase())}`, { headers });
  if (superAdmin.ok) return true;

  const user = await fetchFn(`${base}/users/${encodeURIComponent(payload.sub)}`, { headers });
  if (!user.ok) return false;
  const doc = await user.json();
  const roles = (doc.fields?.roles?.arrayValue?.values ?? []).map((v) => v.stringValue);
  return roles.some((r) => HOST_ROLES.includes(r));
}
