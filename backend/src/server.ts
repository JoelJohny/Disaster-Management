import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { api } from './routes/index.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { ping } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    // The Angular bundle is served from this same origin; the default CSP
    // would block its inline styles.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // NOTE: there is deliberately NO CORS middleware.
  //
  // The API and the Angular app are served from ONE origin — in production by
  // this same process (see below), in development through Angular's dev-server
  // proxy. So cross-origin requests never arise, the session cookie is
  // first-party, and SameSite=Lax is sufficient. The previous
  // `cors({ origin: '*', credentials: true })` was not merely wrong, it is a
  // combination browsers reject outright.

  // requireAuth is mounted on the WHOLE api router. Everything is protected
  // unless it appears in the public allowlist in middleware/auth.ts, so a route
  // added later without any thought about security fails CLOSED.
  app.use('/api/v1', requireAuth, api);

  app.use('/api', notFoundHandler);

  // ---- serve the built Angular app from this same process -----------------
  if (env.serveStatic) {
    // __dirname differs between running the sources and running the build:
    //   tsx        backend/src              → repo root is ../..
    //   compiled   backend/dist/backend/src → repo root is ../../../..
    // (tsconfig sets rootDir to the repo root so packages/contracts compiles
    // too, which nests the output one level deeper than it looks.)
    // Try both, and let STATIC_DIR override for a deployment that relocates
    // the bundle. Getting this wrong is silent: the API keeps working and
    // every page URL 404s.
    const candidates = [
      process.env.STATIC_DIR,
      path.resolve(__dirname, '../../frontend/dist/frontend/browser'),
      path.resolve(__dirname, '../../../../frontend/dist/frontend/browser'),
    ].filter((p): p is string => Boolean(p));

    const dist = candidates.find(p => fs.existsSync(p)) ?? candidates[1];
    if (fs.existsSync(dist)) {
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      // SPA fallback: any non-API path returns index.html so client routing works.
      app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    } else {
      console.warn(`[static] ${dist} not found — run "npm run build" in frontend/ first.`);
    }
  }

  app.use(errorHandler);
  return app;
}

// Only listen when run directly; the tests import createApp() instead.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const app = createApp();
  app.listen(env.port, async () => {
    const db = await ping();
    console.log(`\n  DisasterAid API`);
    console.log(`  ───────────────────────────────────────`);
    console.log(`  listening   http://localhost:${env.port}`);
    console.log(`  database    ${db ? 'connected' : 'UNREACHABLE'} (${env.db.host}:${env.db.port}/${env.db.database})`);
    console.log(`  env         ${env.nodeEnv}\n`);
  });
}
