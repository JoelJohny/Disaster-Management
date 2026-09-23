# DisasterAid — Full Workflow, Start to Finish

Everything from a cold laptop to a finished demo. Every timing below was measured
on this machine, not estimated.

---

## 0. One-time setup (only ever done once)

You have already done this. It is recorded so the project can be rebuilt on
another machine, and so the report can describe it.

```bash
git clone <repo>
cd "Disaster Management"

npm install                 # installs all three workspaces — about 2 minutes
docker compose up -d        # FIRST run only: builds the MySQL volume
```

> **The first `docker compose up -d` is slow.** MySQL initialises its system
> tablespace and then runs `db/01-schema.sql`, `02-grants.sql` and `03-seed.sql`.
> On this laptop it took roughly **40 minutes**, because 22 unrelated containers
> were competing for CPU and disk. On a quiet machine it is 2–4 minutes.
>
> **This only ever happens once.** Afterwards the volume exists and every start
> is under a minute. Never run `docker compose down -v` — the `-v` destroys the
> volume and you pay that cost again. Use `npm run db:reset` instead.

---

## 1. Daily start — 3 commands, about 90 seconds

```bash
npm run db:up            # 44s  — MySQL + Adminer
npm run build            # 50s  — compiles Angular into frontend/dist
npm start                #  2s  — one Node process serves API *and* the app
```

Then open **http://localhost:3000**.

| What | Where |
|---|---|
| The application | http://localhost:3000 |
| API health | http://localhost:3000/api/v1/health |
| Adminer (browse the real tables) | http://localhost:8081 |

**Adminer login:** system `MySQL` · server `mysql` · username `root` ·
password `rootpw` · database `drms`.

### While developing (instead of step 1)

```bash
npm run db:up
npm run dev              # API on :3000 + Angular dev server on :4200, both hot-reloading
```

Use **http://localhost:4200** in this mode. `proxy.conf.json` forwards `/api`
to port 3000, so the browser still sees a single origin and the session cookie
still works — exactly the same shape as production.

---

## 2. Reset to clean demo data — 80 seconds

```bash
npm run db:reset
```

Drops the database, rebuilds all 13 tables, reapplies the grants and reloads the
seed. Run it before a demo, and after any test run that has moved data around.

**Never** `docker compose down -v`. It destroys the volume and costs you the
40-minute first-init again.

---

## 3. Verify everything works — 15 seconds

```bash
npm test                 # 19 integration tests against the real database
npm run race             # the concurrent-claim proof
```

`npm run race` should print:

```
 1 x 201 ACCEPTED
 9 x 409 ALREADY_CLAIMED
 loser sees: "Already accepted by Arun."
 PASS
```

If both are green, the system is working. Nothing else needs checking.

---

## 4. Demo accounts

All four use the password **`Password@123`**. The login page has one-click
buttons so you never type them under pressure.

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@drms.local` | Divya Nair |
| Volunteer | `arun@drms.local` | Approved — can accept requests |
| Volunteer | `meera@drms.local` | **Pending** — approve her during the demo |
| Victim | `priya@drms.local` | Has open and completed requests |
| Victim | `rajesh@drms.local` · `fathima@drms.local` · `suresh@drms.local` | More seeded victims |

> **One browser profile holds one session**, because the session is a single
> HttpOnly same-origin cookie. To show two roles at once you need two separate
> browser contexts — a normal window and an incognito window, or Chrome and Edge.

---

## 5. The application workflow

### 5.1 Victim — asking for help

1. **Register or sign in.** A new victim account is usable immediately.
2. **Dashboard** shows the active disaster event for their district, their open
   request count, and the nearest relief camp with space, with a real computed
   distance (2.4 km to Govt. HSS Aluva for Priya).
3. **Submit a request** through the three-step form:
   *Details* (category, urgency) → *Location* (district, landmark, how many
   people) → *Describe* (what is happening, contact number).
   Each step validates before the next appears.
4. The server assigns a **reference** (`REQ-2026-000047`), attaches the request
   to whichever active disaster covers that location, writes the first
   **status-history** row, and returns.
5. **Track it** in My Requests, filtered by status, with per-status counts that
   come from the server rather than from filtering an array in the browser.
6. **Request detail** shows the full timeline. Once a volunteer accepts, their
   name and phone number appear here.
7. **Cancel** while it is still unaccepted; **rate** once it is completed.

### 5.2 Volunteer — providing help

1. **Sign in.** A new volunteer is `PENDING` and can see the system but cannot
   accept anything until an administrator approves them.
2. **Available Requests** lists unclaimed work, sorted by urgency then distance.
   The victim's **name, phone and exact address are hidden** — only category,
   urgency, approximate distance and headcount are shown.
3. **Accept** one. This is the atomic claim: a transaction plus a unique index
   guarantee only one volunteer can hold it. The loser gets
   *"Already accepted by Arun."* Contact details are released at this moment,
   and the disclosure is written to the audit log.
4. **My Tasks** — advance through the lifecycle. The server refuses illegal
   moves: `ASSIGNED → COMPLETED` directly returns `400`. You must go through
   `IN_PROGRESS`.
5. **Complete** with hours logged, or **release** it back to the pool.

### 5.3 Administrator — coordinating

1. **Dashboard** — open requests, unassigned critical cases, resolved this week,
   volunteers online, a seven-day trend and a live activity feed. All computed
   from current rows.
2. **User Management** — approve or reject pending volunteers. Guardrails stop
   you deactivating your own account or removing the last administrator.
3. **All Requests** — filter by status, category and urgency; assign a volunteer
   directly (which runs the *same* claim service, so the same guarantee applies).
4. **Disaster Events** — create and list events. Their state
   (`UPCOMING` / `ACTIVE` / `PAST`) is **derived from the dates in SQL**, never
   stored, so a stored value can never contradict the dates.
5. **Reports** — request summary by category and status, exportable as CSV.

---

## 6. The status lifecycle

```
                 ┌─────────────┐
                 │  SUBMITTED  │ ◀── victim creates
                 └──────┬──────┘
             ┌──────────┼──────────┐
       claim │          │ cancel   │ (victim only, while unclaimed)
             ▼          ▼          │
      ┌─────────────┐  ┌───────────▼─┐
      │  ASSIGNED   │  │  CANCELLED  │  terminal
      └──────┬──────┘  └─────────────┘
       start │  └── release ──▶ back to SUBMITTED
             ▼
      ┌─────────────┐
      │ IN_PROGRESS │
      └──────┬──────┘
    complete │  └── release ──▶ back to SUBMITTED
             ▼
      ┌─────────────┐
      │  COMPLETED  │  terminal → victim may rate, once
      └─────────────┘
```

Enforced server-side in `requests.service.ts`. Hiding a button in the interface
is convenience; **this table is the rule**, and every transition writes a row to
`request_status_events`.

---

## 7. Viva day — 30 minutes before

```bash
npm run db:up            # 44s
npm run db:reset         # 80s — clean, predictable data
npm run build            # 50s — do this the night before if you can
npm start                # 2s
npm test                 # 15s — confirm 19/19 green, then leave the terminal open
```

Then open and pre-log-in:

| Window | Account |
|---|---|
| Chrome, normal | `admin@drms.local` |
| Chrome, incognito | `priya@drms.local` (victim) |
| Edge, normal | `arun@drms.local` (volunteer) |
| Edge, incognito | `meera@drms.local` (volunteer, pending) |

Also have open: **Adminer on :8081** with the `assignments` table structure on
screen, and a terminal with `npm run race` typed but not yet run.

### If something breaks

| Symptom | Fix |
|---|---|
| Port 3000 in use | `docker ps` — stop whatever holds it. `server-rails-1` has taken it before. |
| Database unreachable | `npm run db:up`, wait for `healthy` in `docker compose ps` |
| Data looks wrong | `npm run db:reset` — 80 seconds, always safe |
| App shows stale UI | Hard refresh: `Ctrl` + `Shift` + `R` |
| Everything is confused | `npm run db:down && npm run db:up && npm run db:reset` — **never** add `-v` |

---

## 8. What each command does

| Command | Time | Purpose |
|---|---:|---|
| `npm run db:up` | 44s | Start MySQL + Adminer |
| `npm run db:down` | 4s | Stop them — **volume preserved** |
| `npm run db:reset` | 80s | Drop, rebuild and reseed the database |
| `npm run db:logs` | — | Follow MySQL's log |
| `npm run build` | 50s | Compile Angular into `frontend/dist` |
| `npm start` | 2s | Serve API + app on :3000 |
| `npm run dev` | — | API + Angular dev server, both hot-reloading |
| `npm test` | 15s | 19 integration tests |
| `npm run race` | 3s | Concurrent-claim proof |

---

## 9. Where things live

```
Disaster Management/
├── db/
│   ├── 01-schema.sql        13 tables — the model of record
│   ├── 02-grants.sql        makes the history table append-only
│   ├── 03-seed.sql          Kerala Floods 2026 demo data
│   └── reset.sql            used by npm run db:reset
├── backend/src/
│   ├── server.ts            serves the API and the built Angular app
│   ├── middleware/auth.ts   deny-by-default authentication
│   ├── services/            business rules, transactions, the atomic claim
│   ├── repositories/        all SQL
│   └── tests/api.test.ts    19 integration tests
├── frontend/src/app/
│   ├── core/                api client, stores, guards, interceptors
│   ├── shared/              loading/empty/error, toasts, confirm dialog
│   ├── layout/              sidebar, header, shells
│   └── features/            the screens
├── packages/contracts/      Zod schemas shared by both halves
├── scripts/race-test.mjs    the concurrency proof
└── docs/                    this runbook, the plan, the design documents
```
