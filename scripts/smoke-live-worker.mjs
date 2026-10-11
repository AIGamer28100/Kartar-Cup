/**
 * Unauthenticated security smoke test for the OpenF1 live Worker (deployed, or local `npm run worker:live:dev`).
 *
 *   npm run worker:live:smoke                                  # against http://127.0.0.1:8788
 *   LIVE=https://kartar-openf1-live.<you>.workers.dev ORIGIN=https://kartar-cup.web.app npm run worker:live:smoke
 *
 * Never sends or prints credentials. Authenticated behaviour (real lap data) is NOT covered here.
 */
const LIVE = (process.env.LIVE ?? 'http://127.0.0.1:8788').replace(/\/+$/, '');
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const PATH = '/v1/live/lap';

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  -> ${detail}` : ''}`);
  if (!ok) failed++;
};

async function call(path, { origin = ORIGIN, token, method = 'GET' } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${LIVE}${path}`, { method, headers });
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { res, body, text };
}

const main = async () => {
  console.log(`worker ${LIVE}\norigin ${ORIGIN}\n`);

  const anon = await call(PATH);
  check('no token is rejected', anon.res.status === 401, `${anon.res.status} ${anon.body.status ?? ''}`);

  const badOrigin = await call(PATH, { origin: 'https://evil.example' });
  check('off-list origin is rejected', badOrigin.res.status === 403, `${badOrigin.res.status} ${badOrigin.body.status ?? ''}`);

  const badToken = await call(PATH, { token: 'not.a.jwt' });
  check('garbage token is rejected', badToken.res.status === 401, `${badToken.res.status} ${badToken.body.status ?? ''}`);

  const post = await call(PATH, { method: 'POST', token: 'x.y.z' });
  check('non-GET is rejected', post.res.status === 405, String(post.res.status));

  const preflight = await call(PATH, { method: 'OPTIONS' });
  check('CORS preflight allows the listed origin', preflight.res.status === 204 && preflight.res.headers.get('access-control-allow-origin') === ORIGIN, `${preflight.res.status} ${preflight.res.headers.get('access-control-allow-origin')}`);

  const badPreflight = await call(PATH, { method: 'OPTIONS', origin: 'https://evil.example' });
  check('CORS preflight refuses an unlisted origin', badPreflight.res.status === 403, String(badPreflight.res.status));

  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
};
main().catch((e) => {
  console.error(`could not reach ${LIVE}: ${e.message}\nStart it with: npm run worker:live:dev`);
  process.exit(1);
});
