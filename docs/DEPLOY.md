# Deploying DisasterAid

One container and one database. The Express process serves the Angular bundle from the same
origin, so there is no separate frontend host, no CORS configuration, and no cross-site
cookie to get wrong.

These instructions are written for [Railway](https://railway.com), which offers managed
MySQL 8 on a private network next to the app. Any host that can run a Dockerfile and reach a
MySQL 8 server works the same way — only the variable plumbing in step 3 changes.

Railway's dashboard labels shift occasionally. The names below were accurate at the time of
writing; if one has moved, the concept is still the one to look for.

---

## What gets deployed

| | |
|---|---|
| **Image** | [`Dockerfile`](../Dockerfile) — Node 24 Alpine, multi-stage, ~340 MB |
| **Process** | `node backend/dist/backend/src/server.js`, serving the API and the Angular bundle |
| **Health check** | `GET /api/v1/health` — configured in [`railway.json`](../railway.json) |
| **Database** | MySQL 8, initialised once with [`scripts/db-deploy.mjs`](../scripts/db-deploy.mjs) |

---

## 1. Create the project and the database

1. Sign in to Railway with GitHub.
2. **New Project → Deploy MySQL**. Wait for it to finish provisioning.

Leave it alone for now. Nothing has to be created inside it by hand — step 4 builds the
schema.

## 2. Add the application

1. In the same project, **New → GitHub Repo → `JoelJohny/Disaster-Management`**.
2. Railway reads [`railway.json`](../railway.json), sees `"builder": "DOCKERFILE"`, and builds
   the image. The first build takes several minutes, mostly `npm ci`.

The first deploy will start and then fail its health check. That is expected: it has no
database credentials yet.

## 3. Set the environment variables

Open the **app service → Variables** and add the values from
[`.env.production.example`](../.env.production.example).

The `DB_*` values are Railway variable references, not literals. Type them exactly as
written, braces included — Railway substitutes the MySQL service's private address, so the
database is never reachable from the internet:

```
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
NODE_ENV=production
SERVE_STATIC=true
SESSION_HOURS=12
```

If the MySQL service is named something other than `MySQL`, use its name in the references.

Then generate a real session secret and paste it as `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> Do not reuse the value in [`.env.example`](../.env.example). That file is public, and so is
> the secret in it. Anyone holding it can mint a valid session cookie for any user, including
> the administrator.

Do **not** set `PORT`. Railway injects it, and the server already reads it.

## 4. Build the schema and seed the data

This runs once, from your machine, over Railway's public TCP proxy. Nothing is installed on
the server.

In the **MySQL service → Variables**, copy `MYSQL_PUBLIC_URL`. Then, from the repository
root:

```bash
MYSQL_URL='<the MYSQL_PUBLIC_URL value>' \
ADMIN_PASSWORD='<a strong password you choose>' \
node scripts/db-deploy.mjs
```

It creates the thirteen tables, loads the Kerala Floods scenario, and then replaces the
administrator's password with the one you supplied.

**Why the admin password is replaced.** The repository is public, so the password in
[`db/03-seed.sql`](../db/03-seed.sql) is public with it. The victim and volunteer demo
accounts keep it deliberately — visitors need a way in — but the account that can approve
volunteers, deactivate users and read every request must not be openable by anyone who reads
the repository.

The script refuses to run against a database that already has tables. Pass `--force` to drop
and rebuild it, which destroys everything in it.

**One thing is lost on a managed host.** [`db/02-grants.sql`](../db/02-grants.sql) is skipped,
because a managed database connects you as a privileged user and will not let you create the
narrow `drms_app` account. Locally, that file is what makes `request_status_events` and
`audit_logs` append-only at the engine. In this deployment, that guarantee is only as strong
as the application code.

## 5. Publish the URL

**App service → Settings → Networking → Generate Domain.**

Redeploy if the service is still sitting in its failed state. The health check at
`/api/v1/health` should go green within a minute.

## 6. Verify

```bash
URL=https://<your-app>.up.railway.app

curl -s $URL/api/v1/health                      # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' $URL/  # 200, and HTML, not JSON

# the published password must no longer open the admin account
curl -s -o /dev/null -w '%{http_code}\n' -X POST $URL/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@drms.local","password":"Password@123"}'   # expect 401
```

Then in a browser: sign in as `priya@drms.local` / `Password@123`, submit a request, and
confirm a deep link such as `/victim/my-requests` loads when pasted directly rather than
returning a 404. That last check is the one that catches a broken static path.

---

## Afterwards

**Updating.** Push to `main`. Railway rebuilds and redeploys automatically.

**Re-seeding.** Re-run step 4 with `--force`. Everything submitted through the live site is
destroyed, which is usually the point before a demonstration.

**Cost.** A small app and database of this size run at roughly $5 of usage credit a month.
There is no permanent free tier.

## When it does not work

| Symptom | Cause |
|---|---|
| Deploy fails the health check, logs say `UNREACHABLE` | `DB_*` references are wrong, or the MySQL service has a different name |
| Site loads but every page is a 404, API responds fine | The Angular bundle was not found. Check the build logs for `[static] ... not found` |
| `ERR_UNKNOWN_FILE_EXTENSION` on start | Node older than 22.18. The image pins 24; a host overriding it will break |
| Login succeeds but the session drops immediately | Site served over plain HTTP. The cookie is `Secure` in production and the browser discards it |
| Build fails in `ng build` with `MODULE_NOT_FOUND` for `lightningcss` | The frontend was installed from the root lockfile, which lacks its dependency tree. The Dockerfile installs it from `frontend/package-lock.json` for this reason |
