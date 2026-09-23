import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  // Keep DECIMAL as a JS number rather than a string; every DECIMAL in this
  // schema is small enough that precision is not at risk.
  decimalNumbers: true,
  dateStrings: false,
  namedPlaceholders: false,
});

export type Row = Record<string, any>;

/** SELECT returning many rows. */
export async function q<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** SELECT returning one row, or null. */
export async function q1<T = Row>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE. */
export async function exec(sql: string, params: any[] = []) {
  const [res] = await pool.execute(sql, params);
  return res as mysql.ResultSetHeader;
}

/**
 * Run `fn` inside a transaction on a dedicated connection.
 * Commits on success, rolls back on any throw.
 */
export async function tx<T>(fn: (c: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    try { await c.rollback(); } catch { /* connection already gone */ }
    throw e;
  } finally {
    c.release();
  }
}

export async function ping(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
