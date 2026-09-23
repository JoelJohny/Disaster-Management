import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import {
  RegisterBody, LoginBody, UpdateProfileBody, CreateRequestBody, ListRequestsQuery,
  CancelRequestBody, UpdateAssignmentBody, CreateFeedbackBody, ListUsersQuery,
  VolunteerApprovalBody, SetUserActiveBody, CreateDisasterBody, KERALA_DISTRICTS,
} from '@drms/contracts';
import { validateBody, validateQuery, body, query } from '../middleware/validate.js';
import { requireRole, requireApprovedVolunteer } from '../middleware/auth.js';
import { COOKIE_NAME } from '../config/env.js';
import { cookieOptions } from '../lib/tokens.js';
import { coordsFor } from '../lib/geo.js';
import { unauthorized, forbidden, notFound, badRequest } from '../lib/errors.js';
import { q, q1, ping } from '../db/pool.js';
import * as auth from '../services/auth.service.js';
import * as reqs from '../services/requests.service.js';
import * as admin from '../services/admin.service.js';
import * as repo from '../repositories/requests.repo.js';

export const api = Router();

/** Wrap an async handler so a rejection reaches the error middleware. */
const h = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

const me = (req: Request) => {
  if (!req.user) throw unauthorized();
  return req.user;
};

// ============================================================ health ======
api.get('/health', h(async (_req, res) => {
  res.json({ status: (await ping()) ? 'ok' : 'degraded', time: new Date().toISOString() });
}));

// ============================================================== auth ======
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.' } },
});

api.post('/auth/register', authLimiter, validateBody(RegisterBody), h(async (req, res) => {
  const { token, userId } = await auth.register(body(req));
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.status(201).json({ user: await auth.currentUser(userId) });
}));

api.post('/auth/login', authLimiter, validateBody(LoginBody), h(async (req, res) => {
  const { token, userId } = await auth.login(body(req));
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ user: await auth.currentUser(userId) });
}));

api.post('/auth/logout', h(async (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
}));

// Public: returns { user: null } when signed out, so the client can restore a
// session on boot without a 401 flashing through the console.
api.get('/auth/me', h(async (req, res) => {
  res.json({ user: req.user ? await auth.currentUser(req.user.id) : null });
}));

api.patch('/auth/me', validateBody(UpdateProfileBody), h(async (req, res) => {
  res.json({ user: await auth.updateProfile(me(req).id, body(req)) });
}));

// ========================================================= reference ======
// One call, cached by the client, replacing several lookup endpoints.
api.get('/reference', h(async (_req, res) => {
  const [categories, skills, activeDisaster] = await Promise.all([
    q<any>('SELECT id, code, name, icon_key, color_key FROM request_categories ORDER BY sort_order'),
    q<any>('SELECT id, code, name FROM skills ORDER BY name'),
    q1<any>(
      `SELECT d.*, ${repo.DISASTER_STATE_SQL} AS state FROM disasters d
        WHERE d.start_date <= UTC_TIMESTAMP(3)
          AND (d.end_date IS NULL OR d.end_date >= UTC_TIMESTAMP(3))
        ORDER BY d.severity DESC LIMIT 1`),
  ]);
  res.json({
    categories: categories.map(c => ({
      id: c.id, code: c.code, name: c.name, iconKey: c.icon_key, colorKey: c.color_key,
    })),
    districts: KERALA_DISTRICTS,
    skills,
    activeDisaster: activeDisaster ? admin.toDisasterDto(activeDisaster) : null,
  });
}));

api.get('/camps', h(async (req, res) => {
  const u = me(req);
  const { lat, lng } = coordsFor(u.district);
  const rows = await q<any>(
    `SELECT c.*, ROUND(ST_Distance_Sphere(POINT(?, ?), POINT(c.longitude, c.latitude))/1000, 1) AS distance_km
       FROM relief_camps c ORDER BY distance_km ASC`,
    [lng, lat],
  );
  res.json({
    items: rows.map(c => ({
      id: c.id, name: c.name, address: c.address, district: c.district,
      capacity: c.capacity, currentOccupancy: c.current_occupancy,
      status: c.status, contactPhone: c.contact_phone, distanceKm: c.distance_km,
    })),
  });
}));

// ========================================================== requests ======
api.get('/requests', validateQuery(ListRequestsQuery), h(async (req, res) => {
  const u = me(req);
  const f = query<any>(req);

  // Scope is role-validated: a victim cannot ask for scope=all and read
  // everyone's requests by changing a query parameter. 403, not 401 — the
  // caller IS authenticated, they are simply not permitted this scope.
  if (f.scope === 'all' && u.role !== 'ADMIN') {
    throw forbidden('Only an administrator can list all requests.');
  }
  if ((f.scope === 'available' || f.scope === 'assigned') &&
      u.role !== 'VOLUNTEER' && u.role !== 'ADMIN') {
    throw forbidden('Only a volunteer can use that scope.');
  }

  const origin = coordsFor(u.district);
  const { items, total, counts } = await repo.list({
    scope: f.scope, userId: u.id, status: f.status, categoryCode: f.categoryCode,
    urgency: f.urgency, search: f.q, sort: f.sort,
    originLat: origin.lat, originLng: origin.lng,
    limit: f.pageSize, offset: (f.page - 1) * f.pageSize,
  });

  res.json({
    items: items.map(r => reqs.toDto(r, u)),
    page: f.page, pageSize: f.pageSize, total, counts,
  });
}));

api.post('/requests', requireRole('VICTIM', 'ADMIN'), validateBody(CreateRequestBody), h(async (req, res) => {
  const out = await reqs.create(me(req), body(req));
  res.status(201).json(out);
}));

api.get('/requests/:id', h(async (req, res) => {
  const u = me(req);
  const id = Number(req.params.id);
  const row = Number.isFinite(id)
    ? await repo.findById(id)
    : await repo.findByReference(String(req.params.id));
  if (!row) throw notFound('Request not found.');

  // Ownership. A victim cannot read another victim's request, an unassigned
  // volunteer cannot read one they have not accepted.
  const allowed =
    u.role === 'ADMIN' ||
    row.victim_id === u.id ||
    row.volunteer_id === u.id ||
    (u.role === 'VOLUNTEER' && row.status === 'SUBMITTED');
  if (!allowed) throw notFound('Request not found.');

  res.json({
    request: reqs.toDto(row, u),
    timeline: (await repo.timeline(row.id)).map((e: any) => ({
      id: e.id, fromStatus: e.from_status, toStatus: e.to_status,
      actorName: e.actor_name, actorRole: e.actor_role, reason: e.reason,
      occurredAt: new Date(e.occurred_at).toISOString(),
    })),
  });
}));

api.post('/requests/:id/cancel', validateBody(CancelRequestBody), h(async (req, res) => {
  res.json(await reqs.cancel(me(req), Number(req.params.id), body<any>(req).reason));
}));

api.post('/requests/:id/claim', requireApprovedVolunteer, h(async (req, res) => {
  res.status(201).json(await reqs.claim(me(req), Number(req.params.id)));
}));

api.post('/requests/:id/feedback', requireRole('VICTIM'), validateBody(CreateFeedbackBody), h(async (req, res) => {
  res.status(201).json(await reqs.addFeedback(me(req), Number(req.params.id), body(req)));
}));

// ======================================================= assignments ======
api.patch('/assignments/:id', validateBody(UpdateAssignmentBody), h(async (req, res) => {
  res.json(await reqs.updateAssignment(me(req), Number(req.params.id), body(req)));
}));

// ====================================================== notifications =====
api.get('/notifications', h(async (req, res) => {
  const u = me(req);
  const items = await q<any>(
    `SELECT id, type, title, body, target_url, read_at, created_at
       FROM notifications WHERE recipient_id = ?
      ORDER BY created_at DESC LIMIT 50`,
    [u.id],
  );
  const unread = await q1<{ n: number }>(
    `SELECT COUNT(*) n FROM notifications WHERE recipient_id = ? AND read_at IS NULL`, [u.id]);
  res.json({
    items: items.map(n => ({
      id: n.id, type: n.type, title: n.title, body: n.body,
      targetUrl: n.target_url,
      readAt: n.read_at ? new Date(n.read_at).toISOString() : null,
      createdAt: new Date(n.created_at).toISOString(),
    })),
    unread: Number(unread?.n ?? 0),
  });
}));

api.post('/notifications/read', h(async (req, res) => {
  const u = me(req);
  await q(`UPDATE notifications SET read_at = UTC_TIMESTAMP(3)
            WHERE recipient_id = ? AND read_at IS NULL`, [u.id]);
  res.json({ ok: true });
}));

// ========================================================= dashboards =====
api.get('/dashboard/victim',    requireRole('VICTIM', 'ADMIN'),    h(async (req, res) => res.json(await admin.victimDashboard(me(req)))));
api.get('/dashboard/volunteer', requireRole('VOLUNTEER', 'ADMIN'), h(async (req, res) => res.json(await admin.volunteerDashboard(me(req)))));
api.get('/dashboard/admin',     requireRole('ADMIN'),              h(async (_req, res) => res.json(await admin.adminDashboard())));

// ============================================================== admin =====
api.get('/users', requireRole('ADMIN'), validateQuery(ListUsersQuery), h(async (req, res) => {
  const f = query<any>(req);
  const out = await admin.listUsers(f);
  res.json({ items: out.items, page: f.page, pageSize: f.pageSize, total: out.total, counts: out.counts });
}));

api.post('/users/:id/volunteer-approval', requireRole('ADMIN'), validateBody(VolunteerApprovalBody), h(async (req, res) => {
  res.json(await admin.decideVolunteer(me(req), Number(req.params.id), body<any>(req).decision));
}));

api.post('/users/:id/active', requireRole('ADMIN'), validateBody(SetUserActiveBody), h(async (req, res) => {
  res.json(await admin.setUserActive(me(req), Number(req.params.id), body<any>(req).isActive));
}));

api.post('/requests/:id/assign', requireRole('ADMIN'), h(async (req, res) => {
  const volunteerId = Number(req.body?.volunteerId);
  if (!Number.isFinite(volunteerId)) throw badRequest('Choose a volunteer.');
  const v = await q1<any>(
    `SELECT u.id, u.full_name, u.role, u.phone, u.email, u.district, vp.approval_status
       FROM users u JOIN volunteer_profiles vp ON vp.user_id = u.id
      WHERE u.id = ? AND u.role = 'VOLUNTEER' AND vp.approval_status = 'APPROVED'`,
    [volunteerId],
  );
  if (!v) throw badRequest('That volunteer is not available for assignment.');
  // Same claim service, so the admin path is protected by the same guarantee.
  const out = await reqs.claim(
    { id: v.id, role: 'VOLUNTEER', fullName: v.full_name, email: v.email,
      phone: v.phone, district: v.district, approvalStatus: 'APPROVED' },
    Number(req.params.id),
  );
  res.status(201).json(out);
}));

api.get('/disasters', h(async (_req, res) => res.json({ items: await admin.listDisasters() })));

api.post('/disasters', requireRole('ADMIN'), validateBody(CreateDisasterBody), h(async (req, res) => {
  res.status(201).json(await admin.createDisaster(me(req), body(req)));
}));

api.get('/reports/request-summary', requireRole('ADMIN'), h(async (req, res) => {
  const rows = await admin.requestSummary();
  if (req.query.format === 'csv') {
    const csv = ['Category,Status,Count', ...rows.map(r => `"${r.category}",${r.status},${r.count}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="request-summary.csv"');
    return res.send(csv);
  }
  res.json({ items: rows });
}));

api.get('/volunteers', requireRole('ADMIN'), h(async (_req, res) => {
  const items = await q<any>(
    `SELECT u.id, u.full_name, u.district, vp.completed_count, vp.rating_avg,
            (SELECT COUNT(*) FROM assignments a
              WHERE a.volunteer_id = u.id AND a.status IN ('ASSIGNED','IN_PROGRESS')) AS active_tasks
       FROM users u JOIN volunteer_profiles vp ON vp.user_id = u.id
      WHERE u.role='VOLUNTEER' AND vp.approval_status='APPROVED' AND u.is_active = TRUE
      ORDER BY active_tasks ASC, vp.rating_avg DESC`,
  );
  res.json({
    items: items.map(v => ({
      id: v.id, fullName: v.full_name, district: v.district,
      completedCount: Number(v.completed_count), ratingAvg: v.rating_avg,
      activeTasks: Number(v.active_tasks),
    })),
  });
}));
