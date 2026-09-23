#!/usr/bin/env node
/**
 * Initialise a hosted MySQL database: schema, then seed, then a private
 * admin password.
 *
 *   node scripts/db-deploy.mjs
 *
 * Reads the connection from MYSQL_URL / DATABASE_URL if present, otherwise
 * from DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME.
 *
 * WHY THIS EXISTS RATHER THAN `mysql < db/01-schema.sql`:
 *
 *   · docker-compose runs db/*.sql through the MySQL image entrypoint, which
 *     has already selected the database and created drms_app. Neither is true
 *     on a managed host, so db/03-seed.sql's `USE drms;` would fail — the
 *     database there is usually called something else — and db/02-grants.sql
 *     cannot run at all, because the account it grants to does not exist and
 *     managed hosts do not hand out the privilege to create it.
 *   · The repository is public. db/03-seed.sql's admin password is therefore
 *     public too, and must not be the admin password of a deployment anyone
 *     can reach.
 *
 * WHAT YOU LOSE without db/02-grants.sql: the append-only guarantee on
 * request_status_events and audit_logs is enforced by privilege in the local
 * stack. A managed host connects you as an all-powerful user, so there the
 * guarantee is only as good as the application code. Nothing else changes.
 *
 * Refuses to touch a database that already has tables unless --force is
 * passed, so it cannot silently wipe a live deployment.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');

// ---------------------------------------------------------------- config ---

function connectionConfig() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  }
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing ${missing.join(', ')} — set those, or MYSQL_URL.`);
    process.exit(1);
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}

const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  console.error(
    'Set ADMIN_PASSWORD to the password you want for admin@drms.local.\n' +
    'It must not be the one in db/03-seed.sql — that file is public.',
  );
  process.exit(1);
}
if (adminPassword.length < 12) {
  console.error('ADMIN_PASSWORD is shorter than 12 characters. Use something longer.');
  process.exit(1);
}

const cfg = connectionConfig();

// Managed MySQL usually requires TLS; a private network usually offers none.
// Try TLS first and fall back, rather than making the caller know which.
async function connect() {
  const base = { ...cfg, multipleStatements: true, timezone: 'Z' };
  try {
    return await mysql.createConnection({ ...base, ssl: { rejectUnauthorized: false } });
  } catch (e) {
    if (!/SSL|TLS|secure/i.test(String(e.message))) throw e;
    console.log('  TLS refused by the server; connecting without it.');
    return await mysql.createConnection(base);
  }
}

const sql = name => readFileSync(path.join(root, 'db', name), 'utf8');

// ------------------------------------------------------------------ run ----

console.log(`\n  Deploying schema to ${cfg.host}:${cfg.port}/${cfg.database}\n`);
const db = await connect();

try {
  const [tables] = await db.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?',
    [cfg.database],
  );
  if (tables[0].n > 0 && !force) {
    console.error(
      `  ${cfg.database} already contains ${tables[0].n} tables.\n` +
      '  Re-run with --force to drop and rebuild it. This destroys all data.\n',
    );
    process.exit(1);
  }

  if (tables[0].n > 0) {
    console.log('  --force: dropping existing tables');
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    const [rows] = await db.query(
      'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?',
      [cfg.database],
    );
    for (const { t } of rows) await db.query(`DROP TABLE IF EXISTS \`${t}\``);
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('  01-schema.sql');
  await db.query(sql('01-schema.sql'));

  // 02-grants.sql is deliberately skipped — see the header of this file.

  console.log('  03-seed.sql');
  await db.query(sql('03-seed.sql').replace(/^USE\s+\w+\s*;/gim, ''));

  console.log('  replacing the public admin password');
  const hash = await bcrypt.hash(adminPassword, 12);
  const [res] = await db.execute(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE email = ?',
    [hash, 'admin@drms.local'],
  );
  if (res.affectedRows !== 1) throw new Error(`expected to update 1 admin row, updated ${res.affectedRows}`);

  const [[counts]] = await db.query(`
    SELECT (SELECT COUNT(*) FROM users)     AS users,
           (SELECT COUNT(*) FROM requests)  AS requests,
           (SELECT COUNT(*) FROM disasters) AS disasters
  `);

  console.log(
    `\n  Done. ${counts.users} users, ${counts.requests} requests, ${counts.disasters} disasters.\n` +
    '  admin@drms.local uses the password you supplied.\n' +
    '  The victim and volunteer demo accounts keep the published one.\n',
  );
} finally {
  await db.end();
}
