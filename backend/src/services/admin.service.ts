import { q, q1, exec, tx } from '../db/pool.js';
import { badRequest, notFound } from '../lib/errors.js';
import { addAudit, addNotification, DISASTER_STATE_SQL } from '../repositories/requests.repo.js';
import { coordsFor } from '../lib/geo.js';
import type { AuthUser } from '../middleware/auth.js';

// ------------------------------------------------------------ users -------
export async function listUsers(f: {
  role?: string; approvalStatus?: string; q?: string; page: number; pageSize: number;
}) {
  const parts: string[] = ['1 = 1'];
  const params: any[] = [];
  if (f.role)           { parts.push('u.role = ?');              params.push(f.role); }
  if (f.approvalStatus) { parts.push('vp.approval_status = ?');  params.push(f.approvalStatus); }
  if (f.q) {
    parts.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${f.q}%`, `%${f.q}%`);
  }
  const where = `WHERE ${parts.join(' AND ')}`;

  const items = await q<any>(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.district, u.is_active,
            u.created_at, vp.approval_status, vp.completed_count, vp.rating_avg
       FROM users u LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id
       ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize],
  );

  const total = await q1<{ n: number }>(
    `SELECT COUNT(*) n FROM users u LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id ${where}`,
    params,
  );

  const counts = await q<{ role: string; n: number }>(
    `SELECT role, COUNT(*) n FROM users GROUP BY role`,
  );
  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[c.role] = Number(c.n);
  countMap['PENDING_VOLUNTEERS'] = Number(
    (await q1<{ n: number }>(
      `SELECT COUNT(*) n FROM volunteer_profiles WHERE approval_status='PENDING'`))?.n ?? 0);

  return {
    items: items.map(r => ({
      id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, role: r.role,
      district: r.district, isActive: Boolean(r.is_active),
      approvalStatus: r.approval_status ?? undefined,
      completedCount: r.completed_count ?? null,
      ratingAvg: r.rating_avg ?? null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    total: Number(total?.n ?? 0),
    counts: countMap,
  };
}

export async function decideVolunteer(admin: AuthUser, userId: number, decision: 'APPROVE' | 'REJECT') {
  const vp = await q1<any>('SELECT user_id, approval_status FROM volunteer_profiles WHERE user_id = ?', [userId]);
  if (!vp) throw notFound('That user is not a volunteer.');

  const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  await tx(async c => {
    await c.execute(
      `UPDATE volunteer_profiles
          SET approval_status = ?, approved_by = ?, approved_at = UTC_TIMESTAMP(3)
        WHERE user_id = ?`,
      [status, admin.id, userId],
    );
    await addNotification(
      c, userId,
      decision === 'APPROVE' ? 'VOLUNTEER_APPROVED' : 'VOLUNTEER_REJECTED',
      decision === 'APPROVE' ? 'Application approved' : 'Application not approved',
      decision === 'APPROVE'
        ? 'Your volunteer application has been approved. You can now accept requests.'
        : 'Your volunteer application was not approved at this time.',
      '/volunteer/dashboard',
    );
    await addAudit(c, admin.id, `volunteer.${decision.toLowerCase()}`, 'user', userId, false);
  });

  return { approvalStatus: status };
}

export async function setUserActive(admin: AuthUser, userId: number, isActive: boolean) {
  // Guardrails. An administrator locking themselves out, or removing the last
  // administrator, would leave the system unadministrable.
  if (userId === admin.id && !isActive) {
    throw badRequest('You cannot deactivate your own account.', 'SELF_DEACTIVATE');
  }
  const target = await q1<any>('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (!target) throw notFound('User not found.');

  if (target.role === 'ADMIN' && !isActive) {
    const remaining = await q1<{ n: number }>(
      `SELECT COUNT(*) n FROM users WHERE role='ADMIN' AND is_active = TRUE AND id <> ?`,
      [userId],
    );
    if (Number(remaining?.n ?? 0) === 0) {
      throw badRequest('You cannot deactivate the last administrator.', 'LAST_ADMIN');
    }
  }

  // Bumping token_version invalidates every session token already issued to
  // this user, without any server-side session store.
  await exec(
    `UPDATE users SET is_active = ?, token_version = token_version + 1 WHERE id = ?`,
    [isActive, userId],
  );
  await addAudit(null, admin.id, isActive ? 'user.activate' : 'user.deactivate', 'user', userId);
  return { isActive };
}

// -------------------------------------------------------- disasters -------
export async function listDisasters() {
  const rows = await q<any>(
    `SELECT d.*, ${DISASTER_STATE_SQL} AS state,
            (SELECT COUNT(*) FROM requests r WHERE r.disaster_id = d.id) AS request_count
       FROM disasters d
      ORDER BY d.start_date DESC`,
  );
  return rows.map(toDisasterDto);
}

export const toDisasterDto = (d: any) => ({
  id: d.id,
  title: d.title,
  type: d.type,
  severity: d.severity,
  district: d.district,
  radiusKm: d.radius_km,
  helplineNumber: d.helpline_number,
  description: d.description,
  startDate: new Date(d.start_date).toISOString(),
  endDate: d.end_date ? new Date(d.end_date).toISOString() : null,
  state: d.state,
  requestCount: d.request_count != null ? Number(d.request_count) : undefined,
});

export async function createDisaster(admin: AuthUser, input: any) {
  const { lat, lng } = coordsFor(input.district);
  const res = await exec(
    `INSERT INTO disasters
       (title, type, severity, district, latitude, longitude, radius_km,
        helpline_number, description, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.title, input.type, input.severity, input.district, lat, lng, input.radiusKm,
     input.helplineNumber ?? null, input.description ?? null,
     new Date(input.startDate), input.endDate ? new Date(input.endDate) : null],
  );
  await addAudit(null, admin.id, 'disaster.create', 'disaster', res.insertId, false, input.title);
  const row = await q1<any>(
    `SELECT d.*, ${DISASTER_STATE_SQL} AS state FROM disasters d WHERE d.id = ?`,
    [res.insertId],
  );
  return toDisasterDto(row);
}

// -------------------------------------------------------- dashboard -------
export async function adminDashboard() {
  const [openRow, critRow, doneRow, onlineRow] = await Promise.all([
    q1<{ n: number }>(`SELECT COUNT(*) n FROM requests WHERE status IN ('SUBMITTED','ASSIGNED','IN_PROGRESS')`),
    q1<{ n: number }>(`SELECT COUNT(*) n FROM requests WHERE status='SUBMITTED' AND urgency='CRITICAL'`),
    q1<{ n: number }>(`SELECT COUNT(*) n FROM requests WHERE status='COMPLETED'
                        AND completed_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY`),
    q1<{ n: number }>(`SELECT COUNT(*) n FROM users
                        WHERE role='VOLUNTEER' AND last_seen_at > UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE`),
  ]);

  // Seven-day trend from real rows.
  const trend = await q<{ d: string; n: number }>(
    `SELECT DATE(submitted_at) d, COUNT(*) n
       FROM requests
      WHERE submitted_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY
      GROUP BY DATE(submitted_at) ORDER BY d ASC`,
  );

  const byType = await q<any>(
    `SELECT c.code, c.name, r.status, COUNT(*) n
       FROM requests r JOIN request_categories c ON c.id = r.category_id
      GROUP BY c.code, c.name, r.status`,
  );

  // The activity feed reads the SAME append-only table that draws the victim's
  // timeline. One write, three readers.
  const activity = await q<any>(
    `SELECT e.id, e.to_status, e.occurred_at, e.actor_role,
            u.full_name AS actor_name, r.reference
       FROM request_status_events e
       JOIN users u    ON u.id = e.actor_id
       JOIN requests r ON r.id = e.request_id
      ORDER BY e.occurred_at DESC LIMIT 12`,
  );

  return {
    kpis: {
      openRequests: Number(openRow?.n ?? 0),
      criticalUnassigned: Number(critRow?.n ?? 0),
      resolvedThisWeek: Number(doneRow?.n ?? 0),
      volunteersOnline: Number(onlineRow?.n ?? 0),
    },
    trend: trend.map(t => ({ date: String(t.d), count: Number(t.n) })),
    byType,
    activity: activity.map(a => ({
      id: a.id,
      reference: a.reference,
      status: a.to_status,
      actorName: a.actor_name,
      actorRole: a.actor_role,
      occurredAt: new Date(a.occurred_at).toISOString(),
    })),
  };
}

export async function volunteerDashboard(user: AuthUser) {
  const [profile, available, activeCount] = await Promise.all([
    q1<any>(
      `SELECT vp.*, GROUP_CONCAT(s.name ORDER BY s.name) AS skills
         FROM volunteer_profiles vp
         LEFT JOIN volunteer_skills vs ON vs.user_id = vp.user_id
         LEFT JOIN skills s            ON s.id = vs.skill_id
        WHERE vp.user_id = ? GROUP BY vp.id`,
      [user.id],
    ),
    q1<{ n: number }>(
      `SELECT COUNT(*) n FROM requests r
        WHERE r.status='SUBMITTED'
          AND NOT EXISTS (SELECT 1 FROM assignments a
                           WHERE a.request_id=r.id AND a.status IN ('ASSIGNED','IN_PROGRESS'))`),
    q1<{ n: number }>(
      `SELECT COUNT(*) n FROM assignments
        WHERE volunteer_id=? AND status IN ('ASSIGNED','IN_PROGRESS')`, [user.id]),
  ]);

  return {
    availableNearby: Number(available?.n ?? 0),
    activeTasks: Number(activeCount?.n ?? 0),
    completedCount: Number(profile?.completed_count ?? 0),
    hoursLogged: Number(profile?.hours_logged ?? 0),
    ratingAvg: profile?.rating_avg ?? null,
    ratingCount: Number(profile?.rating_count ?? 0),
    approvalStatus: profile?.approval_status ?? 'PENDING',
    serviceRadiusKm: Number(profile?.service_radius_km ?? 10),
    skills: profile?.skills ? String(profile.skills).split(',') : [],
  };
}

export async function victimDashboard(user: AuthUser) {
  const { lat, lng } = coordsFor(user.district);

  const [openCount, totalCount, disaster, camp] = await Promise.all([
    q1<{ n: number }>(
      `SELECT COUNT(*) n FROM requests
        WHERE user_id=? AND status IN ('SUBMITTED','ASSIGNED','IN_PROGRESS')`, [user.id]),
    q1<{ n: number }>(`SELECT COUNT(*) n FROM requests WHERE user_id=?`, [user.id]),
    q1<any>(
      `SELECT d.*, ${DISASTER_STATE_SQL} AS state FROM disasters d
        WHERE d.district = ?
          AND d.start_date <= UTC_TIMESTAMP(3)
          AND (d.end_date IS NULL OR d.end_date >= UTC_TIMESTAMP(3))
        ORDER BY d.severity DESC LIMIT 1`,
      [user.district]),
    q1<any>(
      `SELECT c.*, ROUND(ST_Distance_Sphere(POINT(?, ?), POINT(c.longitude, c.latitude))/1000, 1) AS distance_km
         FROM relief_camps c
        WHERE c.status = 'OPEN' AND c.current_occupancy < c.capacity
        ORDER BY distance_km ASC LIMIT 1`,
      [lng, lat]),
  ]);

  return {
    openRequests: Number(openCount?.n ?? 0),
    totalRequests: Number(totalCount?.n ?? 0),
    activeDisaster: disaster ? toDisasterDto(disaster) : null,
    nearestCamp: camp
      ? {
          id: camp.id, name: camp.name, address: camp.address, district: camp.district,
          capacity: camp.capacity, currentOccupancy: camp.current_occupancy,
          status: camp.status, contactPhone: camp.contact_phone,
          distanceKm: camp.distance_km,
        }
      : null,
  };
}

// ----------------------------------------------------------- report -------
export async function requestSummary() {
  const rows = await q<any>(
    `SELECT c.name AS category, r.status, COUNT(*) n
       FROM requests r JOIN request_categories c ON c.id = r.category_id
      GROUP BY c.name, r.status
      ORDER BY c.name`,
  );
  return rows.map(r => ({ category: r.category, status: r.status, count: Number(r.n) }));
}
