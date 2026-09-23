import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '@drms/contracts';

export interface SessionClaims {
  sub: number;
  role: Role;
  tv: number;   // token_version — bumping the column invalidates every issued token
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, env.jwtSecret, {
    expiresIn: `${env.sessionHours}h`,
    issuer: 'drms',
  });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, env.jwtSecret, { issuer: 'drms' }) as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,                       // unreachable from JavaScript
  sameSite: 'lax' as const,             // same-origin deployment, so lax suffices
  secure: env.isProd,
  path: '/',
  maxAge: env.sessionHours * 60 * 60 * 1000,
};
