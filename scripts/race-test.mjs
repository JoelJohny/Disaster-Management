/**
 * Concurrency test for the double-dispatch guarantee.
 *
 * Fires N simultaneous claims at ONE request and asserts that exactly one
 * succeeds. This is the direct verification of the mechanism described in
 * Section 9.1 of the synopsis: a STORED generated column that holds the
 * request id only while an assignment is active, plus a UNIQUE index on it.
 *
 *   node scripts/race-test.mjs [requestId] [concurrency]
 */

const BASE = process.env.API ?? 'http://localhost:3000/api/v1';
const REQUEST_ID = Number(process.argv[2] ?? 1);
const N = Number(process.argv[3] ?? 10);

const ACCOUNTS = [
  'arun@drms.local',
  'sneha@drms.local',
  'rahul@drms.local',
];
const PASSWORD = 'Password@123';

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  const cookie = res.headers.getSetCookie?.().join('; ') ?? res.headers.get('set-cookie');
  if (!cookie) throw new Error(`no session cookie for ${email}`);
  return cookie;
}

const main = async () => {
  console.log(`\n  Concurrent claim test`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  request     #${REQUEST_ID}`);
  console.log(`  concurrency ${N}\n`);

  const cookies = await Promise.all(ACCOUNTS.map(login));

  // Fire them all at once. No await between building and sending.
  const attempts = Array.from({ length: N }, (_, i) =>
    fetch(`${BASE}/requests/${REQUEST_ID}/claim`, {
      method: 'POST',
      headers: { Cookie: cookies[i % cookies.length] },
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) })),
  );

  const results = await Promise.all(attempts);

  const ok = results.filter(r => r.status === 201);
  const conflicts = results.filter(r => r.status === 409);
  const other = results.filter(r => r.status !== 201 && r.status !== 409);

  console.log(`  ${String(ok.length).padStart(2)} x 201 ACCEPTED`);
  console.log(`  ${String(conflicts.length).padStart(2)} x 409 ALREADY_CLAIMED`);
  if (other.length) {
    console.log(`  ${String(other.length).padStart(2)} x other:`,
      [...new Set(other.map(o => `${o.status} ${o.body?.error?.code ?? ''}`))].join(', '));
  }

  const sample = conflicts[0]?.body?.error?.message;
  if (sample) console.log(`\n  loser sees: "${sample}"`);

  const pass = ok.length === 1 && conflicts.length === N - 1;
  console.log(`\n  ${pass ? 'PASS' : 'FAIL'} — expected exactly 1 accepted, ${N - 1} conflicts\n`);
  process.exit(pass ? 0 : 1);
};

main().catch(e => { console.error('\n  ERROR:', e.message, '\n'); process.exit(1); });
