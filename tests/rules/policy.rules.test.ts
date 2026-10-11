import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const host = () => env.authenticatedContext('h1', tok('host@x.com')).firestore();
const guest = () => env.authenticatedContext('g1', tok('guest1@example.com')).firestore();

const eventDoc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  raceId: 'custom',
  title: 'Watch Party',
  venue: { id: 'v1', name: 'Venue', city: 'Chennai' },
  dateUtc: '2026-10-01T00:00:00Z',
  tiers: [{ id: 't1', label: 'Single', priceInr: 500 }],
  discounts: [],
  capacity: 10,
  bookedCount: 0,
  salesOpen: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-policy-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'hosts/host@x.com'), { role: 'host' });
  });
});

describe('bookingEvents policy field', () => {
  const create = (over: Record<string, unknown>) =>
    setDoc(doc(host(), 'bookingEvents/pol1'), eventDoc('pol1', over));

  it('host can set a cancellation policy', async () => {
    await assertSucceeds(create({ policy: 'No refunds. Transfer to a friend until the day before.' }));
  });
  it('a blank policy is allowed (this is how clearing it works)', async () => {
    await assertSucceeds(create({ policy: '' }));
  });
  it('policy is optional', async () => {
    await assertSucceeds(create({}));
  });
  it('rejects a policy over 300 characters', async () => {
    await assertFails(create({ policy: 'x'.repeat(301) }));
  });
  it('rejects a non-string policy', async () => {
    await assertFails(create({ policy: 42 }));
  });
  it('a guest still cannot write the policy', async () => {
    await assertFails(setDoc(doc(guest(), 'bookingEvents/pol2'), eventDoc('pol2', { policy: 'free money' })));
  });
  it('unknown fields are still rejected', async () => {
    await assertFails(create({ refundAll: true }));
  });
});
