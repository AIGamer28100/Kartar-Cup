const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** An unguessable token of `length` base62 characters from the browser's secure RNG. A link that carries
 * one is a capability: whoever holds it can use it, so this must never be Math.random. Rejection sampling
 * (bytes >= 248 are dropped) keeps every character equally likely, with no modulo bias. */
export function randomToken(length = 32): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  let i = 0;
  while (out.length < length) {
    if (i >= buf.length) {
      crypto.getRandomValues(buf);
      i = 0;
    }
    const b = buf[i++];
    if (b < 248) out += ALPHABET[b % 62];
  }
  return out;
}
