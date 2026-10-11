/**
 * Smoke-tests a running Places proxy Worker (local `npm run worker:dev`, or a deployed one).
 * Checks the security properties that are the whole point of the Worker: no key in any response,
 * no access without a Firebase ID token, no access from an origin that is not allow-listed.
 *
 *   npm run worker:smoke                                   # against http://127.0.0.1:8787
 *   PROXY=https://kartar-places-proxy.<you>.workers.dev npm run worker:smoke
 *   ORIGIN=https://kartar-cup.web.app PROXY=... npm run worker:smoke
 *
 * The two authenticated checks run only when you pass a real host ID token:
 *   PLACES_TEST_ID_TOKEN=$(...) npm run worker:smoke
 * Get one in the browser console while signed in as a host:
 *   await (await import('/src/lib/firebase.ts')).auth.currentUser.getIdToken()
 */
const PROXY = (process.env.PROXY ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const TOKEN = process.env.PLACES_TEST_ID_TOKEN;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  -> ${detail}` : ''}`);
  if (!ok) failed++;
};

async function call(path, { origin = ORIGIN, token, method = 'GET' } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${PROXY}${path}`, { method, headers });
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { res, body, text };
}

const main = async () => {
  console.log(`proxy ${PROXY}\norigin ${ORIGIN}\n`);

  const anon = await call('/autocomplete?input=chennai');
  check('no token is rejected', anon.res.status === 401 && anon.body.status === 'UNAUTHENTICATED', `${anon.res.status} ${anon.body.status ?? ''}`);

  const badOrigin = await call('/autocomplete?input=chennai', { origin: 'https://evil.example' });
  check('off-list origin is rejected', badOrigin.res.status === 403 && badOrigin.body.status === 'ORIGIN_NOT_ALLOWED', `${badOrigin.res.status} ${badOrigin.body.status ?? ''}`);

  const badToken = await call('/autocomplete?input=chennai', { token: 'not.a.jwt' });
  check('garbage token is rejected', badToken.res.status === 401, `${badToken.res.status} ${badToken.body.status ?? ''}`);

  const post = await call('/autocomplete?input=chennai', { method: 'POST', token: 'x.y.z' });
  check('non-GET is rejected', post.res.status === 405, String(post.res.status));

  const preflight = await call('/autocomplete', { method: 'OPTIONS' });
  check('CORS preflight allows the listed origin', preflight.res.status === 204 && preflight.res.headers.get('access-control-allow-origin') === ORIGIN, `${preflight.res.status} ${preflight.res.headers.get('access-control-allow-origin')}`);

  const unknown = await call('/whatever', { token: 'x.y.z' });
  check('unknown path is not a tunnel', unknown.res.status === 401 || unknown.res.status === 404, String(unknown.res.status));

  const leaked = [anon, badOrigin, badToken, unknown].some((r) => /AIza[0-9A-Za-z_-]{30,}/.test(r.text));
  check('no Google key in any rejection body', !leaked);

  if (!TOKEN) {
    console.log('\nskipped (no PLACES_TEST_ID_TOKEN): authenticated autocomplete + details');
  } else {
    const ok = await call('/autocomplete?input=marina', { token: TOKEN });
    check('host token gets predictions', ok.res.status === 200 && (ok.body.status === 'OK' || ok.body.status === 'ZERO_RESULTS'), `${ok.res.status} ${ok.body.status ?? ''}`);
    check('no Google key in a success body', !/AIza[0-9A-Za-z_-]{30,}/.test(ok.text));
    const short = await call('/autocomplete?input=ab', { token: TOKEN });
    check('too-short input is rejected', short.res.status === 400, String(short.res.status));
    const pid = ok.body.predictions?.[0]?.place_id;
    if (pid) {
      const det = await call(`/details?place_id=${encodeURIComponent(pid)}`, { token: TOKEN });
      check('details returns geometry only', det.res.status === 200 && !!det.body.result?.geometry && Object.keys(det.body.result).join() === 'geometry', `${det.res.status} ${Object.keys(det.body.result ?? {}).join()}`);
    }
    const badPid = await call('/details?place_id=nope', { token: TOKEN });
    check('malformed place_id is rejected', badPid.res.status === 400, String(badPid.res.status));
  }

  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
};
main().catch((e) => {
  console.error(`could not reach ${PROXY}: ${e.message}\nStart it with: npm run worker:dev`);
  process.exit(1);
});
