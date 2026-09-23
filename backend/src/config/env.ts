import 'node:process';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  isProd: process.env.NODE_ENV === 'production',

  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(required('DB_PORT', '3307')),
    user: required('DB_USER', 'drms_app'),
    password: required('DB_PASSWORD', 'drms_app'),
    database: required('DB_NAME', 'drms'),
  },

  // Development default only. Set JWT_SECRET in the environment for anything real.
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me-in-production-0123456789'),
  sessionHours: Number(process.env.SESSION_HOURS ?? 12),

  /** Serve the built Angular app from the API process (single origin). */
  serveStatic: process.env.SERVE_STATIC !== 'false',
} as const;

export const COOKIE_NAME = 'drms_session';
