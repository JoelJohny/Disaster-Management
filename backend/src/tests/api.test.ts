import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { pool, exec, q1 } from '../db/pool.js';

/**
 * Integration tests against a real MySQL container.
 *
 * These are deliberately few and deliberately chosen: they cover the places
 * where a silent regression means one victim reads another victim's medical
 * details, or two volunteers are dispatched to one house while another house
 * gets nobody. Everything else can be caught by looking at the screen.
 *
 *   npm test          (from the repo root, with `npm run db:up` already done)
 */

const app = createApp();
const PW = 'Password@123';

/** Log in and return the raw Cookie header for subsequent requests. */
async function login(email: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PW });
  expect(res.status, `login failed for ${email}: ${JSON.stringify(res.body)}`).toBe(200);
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw : [raw]).map(c => c.split(';')[0]).join('; ');
}

let victim = '', otherVictim = '', volunteer = '', pending = '', admin = '';

beforeAll(async () => {
  victim      = await login('priya@drms.local');
  otherVictim = await login('fathima@drms.local');
  volunteer   = await login('arun@drms.local');
  admin       = await login('admin@drms.local');
  // Meera may already be approved by an earlier run; force her back to PENDING.
  await exec(`UPDATE volunteer_profiles SET approval_status='PENDING' WHERE user_id=4`);
  pending = await login('meera@drms.local');
});

afterAll(async () => { await pool.end(); });

// ---------------------------------------------------------------- auth ----
describe('authentication', () => {
  it('rejects a wrong password without revealing whether the account exists', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: 'priya@drms.local', password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Incorrect email or password.');
  });

  it('gives the same message for an account that does not exist', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: 'nobody@drms.local', password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Incorrect email or password.');
  });

  it('refuses to register a duplicate email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Duplicate Person', email: 'priya@drms.local', phone: '9847011234',
      district: 'Ernakulam', role: 'VICTIM',
      password: PW, confirmPassword: PW, acceptTerms: true,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors.email).toMatch(/already exists/i);
  });

  it('treats SQL metacharacters in the email as ordinary data', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: "' OR '1'='1", password: 'anything' });
    expect(res.status).toBe(422);          // rejected by validation, never reaches SQL
  });
});

// --------------------------------------------------------------- RBAC ----
describe('access control', () => {
  it('refuses an unauthenticated request', async () => {
    expect((await request(app).get('/api/v1/requests')).status).toBe(401);
  });

  it('denies by default — an endpoint not on the public list needs a session', async () => {
    expect((await request(app).get('/api/v1/dashboard/admin')).status).toBe(401);
  });

  it('refuses a victim reaching an admin endpoint', async () => {
    const res = await request(app).get('/api/v1/users').set('Cookie', victim);
    expect(res.status).toBe(403);
  });

  it('refuses a victim requesting scope=all', async () => {
    const res = await request(app).get('/api/v1/requests?scope=all').set('Cookie', victim);
    expect(res.status).toBe(403);
  });

  it('refuses a victim reading another victim’s request', async () => {
    const own = await request(app).get('/api/v1/requests?scope=mine').set('Cookie', otherVictim);
    const someoneElsesId = own.body.items[0].id;
    const res = await request(app).get(`/api/v1/requests/${someoneElsesId}`).set('Cookie', victim);
    expect(res.status).toBe(404);
  });

  it('scopes a list query so it cannot return another victim’s rows', async () => {
    const res = await request(app).get('/api/v1/requests?scope=mine&pageSize=100').set('Cookie', victim);
    expect(res.status).toBe(200);
    for (const r of res.body.items) expect(r.victim.id).toBe(3);   // Priya
  });

  it('refuses an unapproved volunteer claiming anything', async () => {
    const pool0 = await request(app).get('/api/v1/requests?scope=available').set('Cookie', volunteer);
    const id = pool0.body.items[0].id;
    const res = await request(app).post(`/api/v1/requests/${id}/claim`).set('Cookie', pending);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/awaiting administrator approval/i);
  });
});

// ------------------------------------------------------------ privacy ----
describe('personal data', () => {
  it('withholds victim identity from a volunteer browsing the pool', async () => {
    const res = await request(app).get('/api/v1/requests?scope=available').set('Cookie', volunteer);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const r of res.body.items) expect(r.victim).toBeNull();
  });

  it('releases victim identity to the volunteer who accepted', async () => {
    const pool0 = await request(app).get('/api/v1/requests?scope=available').set('Cookie', volunteer);
    const id = pool0.body.items[0].id;
    const claim = await request(app).post(`/api/v1/requests/${id}/claim`).set('Cookie', volunteer);
    expect(claim.status).toBe(201);

    const after = await request(app).get(`/api/v1/requests/${id}`).set('Cookie', volunteer);
    expect(after.body.request.victim).not.toBeNull();
    expect(after.body.request.victim.phone).toBeTruthy();

    // ...and the disclosure is recorded.
    const audit = await q1<any>(
      `SELECT id FROM audit_logs WHERE entity_type='request' AND entity_id=? AND pii_revealed=TRUE`,
      [id],
    );
    expect(audit).not.toBeNull();
  });
});

// ------------------------------------------------- THE CONCURRENCY TEST ---
describe('double-dispatch guarantee', () => {
  it('permits exactly one volunteer to claim a request, under 10 simultaneous attempts', async () => {
    // A fresh unclaimed request, so the test does not depend on seed ordering.
    const ins = await exec(
      `INSERT INTO requests
         (reference, user_id, disaster_id, category_id, urgency, status, description,
          location_text, district, latitude, longitude, people_count, contact_phone)
       VALUES (?, 3, 1, 3, 'HIGH', 'SUBMITTED', 'Race test fixture',
               'Test location', 'Ernakulam', 10.1081, 76.3517, 1, '+91 98470 11234')`,
      // reference is VARCHAR(20); the low 9 digits of the clock keep it unique
      // across runs without overflowing the column.
      [`REQ-TEST-${String(Date.now()).slice(-9)}`],
    );
    const id = ins.insertId;
    await exec(
      `INSERT INTO request_status_events (request_id, to_status, actor_id, actor_role)
       VALUES (?, 'SUBMITTED', 3, 'VICTIM')`, [id],
    );

    const cookies = [volunteer, await login('sneha@drms.local'), await login('rahul@drms.local')];

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app).post(`/api/v1/requests/${id}/claim`).set('Cookie', cookies[i % cookies.length]),
      ),
    );

    const accepted = results.filter(r => r.status === 201);
    const conflicts = results.filter(r => r.status === 409);

    expect(accepted).toHaveLength(1);
    expect(conflicts).toHaveLength(9);

    // And the database agrees: exactly one active assignment row.
    const row = await q1<{ n: number }>(
      `SELECT COUNT(*) n FROM assignments WHERE active_request_id = ?`, [id],
    );
    expect(Number(row!.n)).toBe(1);
  });
});

// ----------------------------------------------------------- lifecycle ---
describe('status lifecycle', () => {
  it('refuses an illegal transition from ASSIGNED straight to COMPLETED', async () => {
    const mine = await request(app).get('/api/v1/requests?scope=assigned&status=ASSIGNED')
      .set('Cookie', volunteer);
    const withAssignment = mine.body.items.find((r: any) => r.assignment?.status === 'ASSIGNED');
    expect(withAssignment, 'no ASSIGNED task available for this test').toBeTruthy();

    const res = await request(app)
      .patch(`/api/v1/assignments/${withAssignment.assignment.id}`)
      .set('Cookie', volunteer)
      .send({ action: 'COMPLETE', hoursLogged: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
  });
});

// ------------------------------------------------------------ feedback ---
describe('feedback', () => {
  it('permits one rating per request and rejects a second', async () => {
    const done = await request(app)
      .get('/api/v1/requests?scope=mine&status=COMPLETED&pageSize=100').set('Cookie', victim);
    const unrated = done.body.items.find((r: any) => !r.hasFeedback);
    expect(unrated, 'no unrated completed request available').toBeTruthy();

    const first = await request(app).post(`/api/v1/requests/${unrated.id}/feedback`)
      .set('Cookie', victim).send({ rating: 5, comments: 'Thank you', contactPermission: false });
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/v1/requests/${unrated.id}/feedback`)
      .set('Cookie', victim).send({ rating: 3, comments: 'Again', contactPermission: false });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_FEEDBACK');
  });
});

// --------------------------------------------------------- admin guards --
describe('administrative guardrails', () => {
  it('prevents an administrator deactivating their own account', async () => {
    const res = await request(app).post('/api/v1/users/1/active')
      .set('Cookie', admin).send({ isActive: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_DEACTIVATE');
  });

  it('derives disaster state from the dates rather than storing it', async () => {
    const res = await request(app).get('/api/v1/disasters').set('Cookie', admin);
    expect(res.status).toBe(200);
    const states = res.body.items.map((d: any) => d.state);
    expect(states).toContain('ACTIVE');
    expect(states).toContain('PAST');
    expect(states).toContain('UPCOMING');
  });
});

// -------------------------------------------------------------- listing --
describe('list envelope', () => {
  it('returns per-status counts alongside the page', async () => {
    const res = await request(app).get('/api/v1/requests?scope=mine&pageSize=5').set('Cookie', victim);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('counts.SUBMITTED');
    const sum = Object.values(res.body.counts as Record<string, number>)
      .reduce((a, b) => a + Number(b), 0);
    expect(sum).toBe(res.body.total);
  });
});
