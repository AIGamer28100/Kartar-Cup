// Seeds the local Firestore emulator only. Usage: npm run seed (emulators must be running).
const PROJECT = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'demo-kartar-cup';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const str = (stringValue) => ({ stringValue });
const ts = (d) => ({ timestampValue: d.toISOString() });

async function put(path, fields) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

const now = Date.now();
await put('event/current', {
  status: str('open'),
  lightsOutUtc: ts(new Date(now + 2 * 3600_000)),
  winnerRevealed: { booleanValue: false },
  tiebreakOverride: { nullValue: null },
});
await put('hosts/host@example.com', { addedAt: ts(new Date(now)) });

const entries = [
  ['seed-priya', 'Priya Venkatesh', '+91 98410 22017', { q1: 'williams', q2: 'norris', q3: 'stroll', q4: 'red-bull', q5: 'russell' }],
  ['seed-karthik', 'Karthik Subramanian', '+91 94440 51236', { q1: 'haas', q2: 'verstappen', q3: 'ocon', q4: 'mclaren', q5: 'leclerc' }],
  ['seed-meenakshi', 'Meenakshi Iyer', undefined, { q1: 'cadillac', q2: 'hamilton', q3: 'bottas', q4: 'ferrari', q5: 'piastri' }],
];
for (const [i, [uid, name, phone, a]] of entries.entries()) {
  const when = ts(new Date(now - (30 - i * 7) * 60_000));
  const fields = {
    uid: str(uid),
    name: str(name),
    provider: str('anonymous'),
    answers: { mapValue: { fields: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, str(v)])) } },
    submittedAt: when,
    createdAt: when,
  };
  if (phone) fields.phone = str(phone);
  await put(`entries/${uid}`, fields);
}
console.log(`Seeded ${PROJECT} on ${HOST}: event/current, hosts/host@example.com, ${entries.length} entries`);
