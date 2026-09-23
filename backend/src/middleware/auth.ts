import type { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME } from '../config/env.js';
import { verifySession } from '../lib/tokens.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { q1, exec } from '../db/pool.js';
import type { Role } from '@drms/contracts';

export interface AuthUser {
  id: number;
  role: Role;
  fullName: string;
  email: string;
  phone: string;
  district: string;
  approvalStatus: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Endpoints reachable without a session. Everything else requires one.
 *
 * This list is the ONLY way to make an endpoint public. `requireAuth` is
 * mounted on the entire /api/v1 router, so a route added later without any
 * thought about its security requires authentication by default — it fails
 * CLOSED. The opposite arrangement, attaching a guard per route, fails OPEN
 * when somebody forgets, which is the more dangerous direction.
 */
const PUBLIC: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/auth\/register$/ },
  { method: 'POST', path: /^\/auth\/login$/ },
  { method: 'POST', path: /^\/auth\/logout$/ },
  { method: 'GET',  path: /^\/auth\/me$/ },      // returns { user: null } when signed out
  { method: 'GET',  path: /^\/health$/ },
];

const isPublic = (method: string, path: string) =>
  PUBLIC.some(r => r.method === method && r.path.test(path));

/** Resolve the session cookie to a user, or undefined. Never throws. */
export async function loadUser(req: Request): Promise<AuthUser | undefined> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return undefined;

  const claims = verifySession(token);
  if (!claims) return undefined;

  const row = await q1<any>(
    `SELECT u.id, u.role, u.full_name, u.email, u.phone, u.district,
            u.is_active, u.token_version, vp.approval_status
       FROM users u
       LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id
      WHERE u.id = ?`,
    [claims.sub],
  );
  if (!row || !row.is_active) return undefined;

  // token_version lets a password change, role change or deactivation
  // invalidate every token already issued, without server-side session storage.
  if (row.token_version !== claims.tv) return undefined;

  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    district: row.district,
    approvalStatus: row.approval_status ?? null,
  };
}

/** Mounted on the whole API router. Deny by default. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.user = await loadUser(req);

    if (isPublic(req.method, req.path)) return next();
    if (!req.user) return next(unauthorized());

    // Touch last_seen_at so "volunteers online" is a real figure, computed from
    // requests the client already makes rather than a presence subsystem.
    void exec('UPDATE users SET last_seen_at = UTC_TIMESTAMP(3) WHERE id = ?', [req.user.id])
      .catch(() => { /* best effort; never fail a request over this */ });

    next();
  } catch (e) {
    next(e);
  }
}

/** Restrict an endpoint to one or more roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`This action requires the ${roles.join(' or ')} role.`));
    }
    next();
  };
}

/**
 * A volunteer may only act on requests once an administrator has approved them.
 * This is the principal safeguard on victims' personal data: without it, open
 * self-registration would hand any stranger a geolocated list of isolated
 * households with telephone numbers.
 */
export function requireApprovedVolunteer(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'VOLUNTEER') {
    return next(forbidden('This action requires the VOLUNTEER role.'));
  }
  if (req.user.approvalStatus !== 'APPROVED') {
    return next(forbidden('Your volunteer account is awaiting administrator approval.'));
  }
  next();
}
