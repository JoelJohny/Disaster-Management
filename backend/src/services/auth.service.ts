import { tx, q1, exec } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signSession } from '../lib/tokens.js';
import { conflict, unauthorized, validation } from '../lib/errors.js';
import type { LoginBody, RegisterBody, UserDto } from '@drms/contracts';

export async function register(input: RegisterBody) {
  const existing = await q1<{ id: number }>('SELECT id FROM users WHERE email = ?', [input.email]);
  if (existing) {
    // A field-level error so the form can point at the offending input.
    throw validation({ email: 'An account with this email already exists.' });
  }

  const hash = await hashPassword(input.password);

  const userId = await tx(async c => {
    const [res]: any = await c.execute(
      `INSERT INTO users (full_name, email, password_hash, phone, role, district, terms_accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [input.fullName, input.email, hash, input.phone, input.role, input.district],
    );
    const id = res.insertId as number;

    // A volunteer starts PENDING and cannot claim anything until an
    // administrator approves them. This gate is the main safeguard on
    // victims' personal data, and it replaces email verification.
    if (input.role === 'VOLUNTEER') {
      await c.execute(
        `INSERT INTO volunteer_profiles (user_id, approval_status) VALUES (?, 'PENDING')`,
        [id],
      );
    }
    return id;
  });

  return issueSession(userId);
}

export async function login(input: LoginBody) {
  const row = await q1<any>(
    `SELECT id, password_hash, is_active FROM users WHERE email = ?`,
    [input.email],
  );

  // Always compare against *something* so the response time does not reveal
  // whether the address exists, and give one generic message either way.
  const hash = row?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await verifyPassword(input.password, hash);

  if (!row || !ok) throw unauthorized('Incorrect email or password.');
  if (!row.is_active) throw unauthorized('This account has been deactivated.');

  return issueSession(row.id);
}

async function issueSession(userId: number) {
  const u = await q1<any>(
    `SELECT id, role, token_version FROM users WHERE id = ?`,
    [userId],
  );
  const token = signSession({ sub: u.id, role: u.role, tv: u.token_version });
  return { token, userId: u.id as number };
}

export async function currentUser(userId: number): Promise<UserDto | null> {
  const r = await q1<any>(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.district, u.is_active,
            u.created_at, vp.approval_status
       FROM users u LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id
      WHERE u.id = ?`,
    [userId],
  );
  if (!r) return null;
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    district: r.district,
    isActive: Boolean(r.is_active),
    approvalStatus: r.approval_status ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function updateProfile(
  userId: number,
  input: { fullName: string; phone: string; district: string },
) {
  await exec(
    `UPDATE users SET full_name = ?, phone = ?, district = ? WHERE id = ?`,
    [input.fullName, input.phone, input.district, userId],
  );
  return currentUser(userId);
}
