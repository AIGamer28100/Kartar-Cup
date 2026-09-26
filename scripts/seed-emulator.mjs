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
const EID = 'test-event';
const arr = (values) => ({ arrayValue: { values } });
const map = (fields) => ({ mapValue: { fields } });
const num = (integerValue) => ({ integerValue: String(integerValue) });
const teams = [['mercedes', 'Mercedes'], ['ferrari', 'Ferrari'], ['mclaren', 'McLaren'], ['red-bull', 'Red Bull'],
  ['alpine', 'Alpine'], ['haas', 'Haas'], ['racing-bulls', 'Racing Bulls'], ['williams', 'Williams'],
  ['audi', 'Audi'], ['cadillac', 'Cadillac'], ['aston-martin', 'Aston Martin']];
const drivers = [['russell', 'Russell', 'mercedes'], ['leclerc', 'Leclerc', 'ferrari'], ['piastri', 'Piastri', 'mclaren'],
  ['hadjar', 'Hadjar', 'red-bull'], ['norris', 'Norris', 'mclaren'], ['hamilton', 'Hamilton', 'ferrari'],
  ['gasly', 'Gasly', 'alpine'], ['verstappen', 'Verstappen', 'red-bull'], ['colapinto', 'Colapinto', 'alpine'],
  ['bearman', 'Bearman', 'haas'], ['lawson', 'Lawson', 'racing-bulls'], ['albon', 'Albon', 'williams'],
  ['ocon', 'Ocon', 'haas'], ['sainz', 'Sainz', 'williams'], ['lindblad', 'Lindblad', 'racing-bulls'],
  ['antonelli', 'Antonelli', 'mercedes'], ['bortoleto', 'Bortoleto', 'audi'], ['hulkenberg', 'Hulkenberg', 'audi'],
  ['perez', 'Perez', 'cadillac'], ['bottas', 'Bottas', 'cadillac'], ['alonso', 'Alonso', 'aston-martin'],
  ['stroll', 'Stroll', 'aston-martin']];
const questions = [
  ['q1', 'team', 'Which constructor has the SLOWEST pit stop?', 'Box, box... and then a long, awkward silence on the radio.'],
  ['q2', 'driver', 'Which driver makes the MOST overtakes?', 'Copy, we are going for the gap. Do not lift.'],
  ['q3', 'driver', 'Which driver will DNF?', 'Stop the car, stop the car. Check the barriers.'],
  ['q4', 'team', 'Which constructor has the FASTEST pit stop?', 'Gun crew is ready. Two seconds or we talk about it.'],
  ['q5', 'driver', 'Which driver sets the FASTEST LAP?', 'Purple sector, purple sector. Send it, no mercy.'],
];
// Quiz is open: opensAt = now-1min, closesAt = now+81min (90 min race, 0.9 x duration).
await put(`events/${EID}`, {
  id: str(EID),
  raceId: str('custom'),
  name: str('Race Watch Party'),
  subtitle: str('The Karter Cup watch party'),
  circuit: { nullValue: null },
  themeId: str('default'),
  raceStartUtc: ts(new Date(now - 60_000)),
  raceDurationMin: num(90),
  opensAt: ts(new Date(now - 60_000)),
  closesAt: ts(new Date(now + 81 * 60_000)),
  override: str('none'),
  whatsappUrl: str(''),
  teams: arr(teams.map(([id, label]) => map({ id: str(id), label: str(label) }))),
  drivers: arr(drivers.map(([id, label, teamId], i) => map({ id: str(id), label: str(label), teamId: str(teamId), grid: num(i + 1) }))),
  questions: arr(questions.map(([id, kind, prompt, hint]) => map({ id: str(id), kind: str(kind), prompt: str(prompt), hint: str(hint) }))),
  questionIds: arr(questions.map(([id]) => str(id))),
  winnerRevealed: { booleanValue: false },
  tiebreakOverride: { nullValue: null },
  createdAt: ts(new Date(now)),
  updatedAt: ts(new Date(now)),
});
await put('settings/active', { eventId: str(EID) });
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
    provider: str('google'),
    email: str(`${uid}@example.com`),
    answers: { mapValue: { fields: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, str(v)])) } },
    submittedAt: when,
    createdAt: when,
  };
  if (phone) fields.phone = str(phone);
  await put(`events/${EID}/entries/${uid}`, fields);
}
console.log(`Seeded ${PROJECT} on ${HOST}: settings/active, events/${EID}, hosts/host@example.com, ${entries.length} entries`);
