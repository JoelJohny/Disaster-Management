import type { PoolConnection } from 'mysql2/promise';
import { q, q1, exec, pool } from '../db/pool.js';
import type { RequestStatus, Urgency } from '@drms/contracts';

/**
 * `disaster_state` is DERIVED here, never stored — a stored copy can
 * contradict the dates, which is exactly what the original mock data did.
 */
export const DISASTER_STATE_SQL = `
  CASE
    WHEN d.start_date > UTC_TIMESTAMP(3) THEN 'UPCOMING'
    WHEN d.end_date IS NOT NULL AND d.end_date < UTC_TIMESTAMP(3) THEN 'PAST'
    ELSE 'ACTIVE'
  END`;

/** The FROM/JOIN block shared by every request query. */
const REQUEST_FROM = `
    FROM requests r
    JOIN request_categories c ON c.id = r.category_id
    JOIN users victim         ON victim.id = r.user_id
    LEFT JOIN disasters d     ON d.id = r.disaster_id
    LEFT JOIN assignments a   ON a.request_id = r.id
                             AND a.status IN ('ASSIGNED','IN_PROGRESS','COMPLETED')
                             AND a.id = (SELECT MAX(a2.id) FROM assignments a2
                                          WHERE a2.request_id = r.id
                                            AND a2.status IN ('ASSIGNED','IN_PROGRESS','COMPLETED'))
    LEFT JOIN users vol             ON vol.id = a.volunteer_id
    LEFT JOIN volunteer_profiles vp ON vp.user_id = vol.id
    LEFT JOIN feedback fb           ON fb.request_id = r.id`;

const REQUEST_COLS = `
         r.id, r.reference, r.urgency, r.status, r.description, r.location_text,
         r.district, r.latitude, r.longitude, r.people_count, r.contact_phone,
         r.source, r.submitted_at, r.completed_at, r.cancelled_at,
         c.code AS category_code, c.name AS category_name,
         d.title AS disaster_title,
         victim.id AS victim_id, victim.full_name AS victim_name, victim.phone AS victim_phone,
         a.id  AS assignment_id, a.status AS assignment_status,
         a.progress_pct, a.hours_logged, a.completion_notes,
         vol.id AS volunteer_id, vol.full_name AS volunteer_name, vol.phone AS volunteer_phone,
         vp.rating_avg AS volunteer_rating,
         (fb.id IS NOT NULL) AS has_feedback`;

/** Build a SELECT over REQUEST_FROM, optionally with a computed distance column. */
const requestSelect = (distanceExpr = 'NULL') =>
  `SELECT ${REQUEST_COLS}, ${distanceExpr} AS distance_km ${REQUEST_FROM}`;

const REQUEST_SELECT = requestSelect();

export interface RequestRow {
  id: number; reference: string; urgency: Urgency; status: RequestStatus;
  description: string; location_text: string; district: string;
  latitude: number; longitude: number; people_count: number; contact_phone: string;
  source: string; submitted_at: Date; completed_at: Date | null; cancelled_at: Date | null;
  category_code: string; category_name: string; disaster_title: string | null;
  victim_id: number; victim_name: string; victim_phone: string;
  assignment_id: number | null; assignment_status: string | null;
  progress_pct: number | null; hours_logged: number | null; completion_notes: string | null;
  volunteer_id: number | null; volunteer_name: string | null; volunteer_phone: string | null;
  volunteer_rating: number | null;
  has_feedback: number;
  distance_km?: number;
}

export const findById = (id: number) =>
  q1<RequestRow>(`${REQUEST_SELECT} WHERE r.id = ?`, [id]);

export const findByReference = (ref: string) =>
  q1<RequestRow>(`${REQUEST_SELECT} WHERE r.reference = ?`, [ref]);

export interface ListFilters {
  scope: 'mine' | 'available' | 'assigned' | 'all';
  userId: number;
  status?: RequestStatus;
  categoryCode?: string;
  urgency?: Urgency;
  search?: string;
  sort: 'urgency' | 'distance' | 'newest';
  originLat?: number;
  originLng?: number;
  limit: number;
  offset: number;
}

function scopeClause(f: ListFilters): { sql: string; params: any[] } {
  switch (f.scope) {
    case 'mine':
      return { sql: 'r.user_id = ?', params: [f.userId] };
    case 'available':
      // Unclaimed work only. The NOT EXISTS is belt-and-braces alongside the
      // status check: a request cannot be in the pool if something active
      // already points at it.
      return {
        sql: `r.status = 'SUBMITTED' AND NOT EXISTS (
                SELECT 1 FROM assignments ax
                 WHERE ax.request_id = r.id AND ax.status IN ('ASSIGNED','IN_PROGRESS'))`,
        params: [],
      };
    case 'assigned':
      // Everything this volunteer has ever worked on, including completed work.
      // Filtering on the generated column would silently drop completed tasks,
      // because that column is NULL once an assignment is no longer active.
      return {
        sql: `EXISTS (SELECT 1 FROM assignments ay
                       WHERE ay.request_id = r.id AND ay.volunteer_id = ?
                         AND ay.status IN ('ASSIGNED','IN_PROGRESS','COMPLETED'))`,
        params: [f.userId],
      };
    case 'all':
      return { sql: '1 = 1', params: [] };
  }
}

function filterClause(f: ListFilters): { sql: string; params: any[] } {
  const parts: string[] = [];
  const params: any[] = [];
  if (f.status)       { parts.push('r.status = ?');   params.push(f.status); }
  if (f.categoryCode) { parts.push('c.code = ?');     params.push(f.categoryCode); }
  if (f.urgency)      { parts.push('r.urgency = ?');  params.push(f.urgency); }
  if (f.search) {
    parts.push('(r.reference LIKE ? OR r.location_text LIKE ? OR victim.full_name LIKE ?)');
    const like = `%${f.search}%`;
    params.push(like, like, like);
  }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
}

export async function list(f: ListFilters) {
  const sc = scopeClause(f);
  const fc = filterClause(f);
  const where = `WHERE ${sc.sql}${fc.sql}`;
  const whereParams = [...sc.params, ...fc.params];

  // Distance in kilometres, computed by MySQL. ST_Distance_Sphere returns
  // metres and takes POINT(longitude, latitude) — in that order.
  const hasOrigin = f.originLat != null && f.originLng != null;
  const distanceExpr = hasOrigin
    ? 'ROUND(ST_Distance_Sphere(POINT(?, ?), POINT(r.longitude, r.latitude)) / 1000, 1)'
    : 'NULL';
  const distParams = hasOrigin ? [f.originLng, f.originLat] : [];

  // `urgency + 0` sorts by the ENUM's declaration ordinal. Wrapping the column
  // in CASE would strip the ordinal and sort lexically, which puts CRITICAL
  // last — the exact opposite of what the volunteer queue needs.
  const order =
    f.sort === 'urgency'  ? 'r.urgency + 0 DESC, r.submitted_at ASC'
    : f.sort === 'distance' && hasOrigin ? 'distance_km ASC, r.urgency + 0 DESC'
    : 'r.submitted_at DESC';

  const items = await q<RequestRow>(
    `${requestSelect(distanceExpr)} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...distParams, ...whereParams, f.limit, f.offset],
  );

  const totalRow = await q1<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM requests r
       JOIN request_categories c ON c.id = r.category_id
       JOIN users victim ON victim.id = r.user_id
       ${where}`,
    whereParams,
  );

  // Per-status counts for the filter pills, in the same round trip as the page.
  // Deliberately ignores the status filter itself, so the badges do not vanish
  // when a pill is selected.
  const scOnly = scopeClause(f);
  const fcNoStatus = filterClause({ ...f, status: undefined });
  const countRows = await q<{ status: string; n: number }>(
    `SELECT r.status, COUNT(*) AS n
       FROM requests r
       JOIN request_categories c ON c.id = r.category_id
       JOIN users victim ON victim.id = r.user_id
      WHERE ${scOnly.sql}${fcNoStatus.sql}
      GROUP BY r.status`,
    [...scOnly.params, ...fcNoStatus.params],
  );

  const counts: Record<string, number> = {
    SUBMITTED: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0,
  };
  for (const r of countRows) counts[r.status] = Number(r.n);

  return { items, total: Number(totalRow?.n ?? 0), counts };
}

/**
 * Next reference in REQ-YYYY-NNNNNN form.
 *
 * Derived from the highest existing suffix, NOT from COUNT(*). Counting rows
 * collides the moment the sequence has any gap — and the seed deliberately has
 * gaps, so COUNT(*)+1 produced a reference the seed already held.
 *
 * Called inside the caller's transaction, so two simultaneous submissions
 * cannot both read the same maximum.
 */
export async function nextReference(c?: PoolConnection): Promise<string> {
  const year = new Date().getUTCFullYear();
  const sql = `SELECT COALESCE(MAX(CAST(SUBSTRING(reference, 10) AS UNSIGNED)), 0) + 1 AS n
                 FROM requests
                WHERE reference LIKE ?`;
  const params = [`REQ-${year}-%`];

  let n: number;
  if (c) {
    const [rows]: any = await c.execute(sql, params);
    n = Number(rows[0]?.n ?? 1);
  } else {
    const row = await q1<{ n: number }>(sql, params);
    n = Number(row?.n ?? 1);
  }
  return `REQ-${year}-${String(n).padStart(6, '0')}`;
}

/** The active disaster event whose radius covers a point, if any. */
export const findCoveringDisaster = (lat: number, lng: number) =>
  q1<{ id: number }>(
    `SELECT d.id
       FROM disasters d
      WHERE d.start_date <= UTC_TIMESTAMP(3)
        AND (d.end_date IS NULL OR d.end_date >= UTC_TIMESTAMP(3))
        AND ST_Distance_Sphere(POINT(d.longitude, d.latitude), POINT(?, ?)) <= d.radius_km * 1000
      ORDER BY ST_Distance_Sphere(POINT(d.longitude, d.latitude), POINT(?, ?)) ASC
      LIMIT 1`,
    [lng, lat, lng, lat],
  );

export const timeline = (requestId: number) =>
  q<any>(
    `SELECT e.id, e.from_status, e.to_status, e.reason, e.occurred_at,
            e.actor_role, u.full_name AS actor_name
       FROM request_status_events e
       JOIN users u ON u.id = e.actor_id
      WHERE e.request_id = ?
      ORDER BY e.occurred_at ASC, e.id ASC`,
    [requestId],
  );

/** Append a transition. INSERT only — the app account cannot UPDATE or DELETE here. */
export async function addStatusEvent(
  c: PoolConnection | null,
  requestId: number,
  from: RequestStatus | null,
  to: RequestStatus,
  actorId: number,
  actorRole: string,
  reason?: string,
) {
  const sql = `INSERT INTO request_status_events
                 (request_id, from_status, to_status, actor_id, actor_role, reason)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [requestId, from, to, actorId, actorRole, reason ?? null];
  if (c) await c.execute(sql, params);
  else await exec(sql, params);
}

export async function addNotification(
  c: PoolConnection | null,
  recipientId: number,
  type: string,
  title: string,
  bodyText: string,
  targetUrl?: string,
) {
  const sql = `INSERT INTO notifications (recipient_id, type, title, body, target_url)
               VALUES (?, ?, ?, ?, ?)`;
  const params = [recipientId, type, title, bodyText, targetUrl ?? null];
  if (c) await c.execute(sql, params);
  else await exec(sql, params);
}

export async function addAudit(
  c: PoolConnection | null,
  actorId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  piiRevealed = false,
  detail?: string,
) {
  const sql = `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, pii_revealed, detail)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [actorId, action, entityType, entityId, piiRevealed, detail ?? null];
  if (c) await c.execute(sql, params);
  else await exec(sql, params);
}

export { pool };
