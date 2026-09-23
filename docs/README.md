# DRMS — Design Documents

Disaster Relief Management System. MCA final-semester project.
Angular 20 + Express 5 + MySQL 8, single origin, localhost demo.

Generated 2026-09-20 from a 27-agent design process: a screen-by-screen survey of the
existing UI, a four-way architecture panel scored by three judges, a re-scope against the
one-month deadline, and three adversarial critiques (MySQL DBA, deadline realism,
cross-artifact coherence).

## Read in this order

| Document | What it is |
|---|---|
| [RUNBOOK.md](RUNBOOK.md) | **How to run it.** Cold start, daily start, reset, demo-day sequence, the full user workflow for all three roles, and what to do when something breaks. |
| [PLAN.md](PLAN.md) | **Start here.** Verdict, scope, the 12 blockers, first ten actions, four-week schedule, cut line, risks. |
| [user-map.html](user-map.html) | **Visual map.** Entry and auth flow, the three journeys, one request moving between all three roles, the full route table, an access-control matrix and the status lifecycle. Open in a browser. |
| [DEMO.md](DEMO.md) | The 19-step viva click-path. The whole build serves this. |
| [DEVENV.md](DEVENV.md) | docker-compose, npm scripts, same-origin setup, demo-day runbook. |
| [DATABASE.md](DATABASE.md) | Ten tables, the atomic-claim guarantee, 26 MySQL-specific decisions, seed plan. |
| [API.md](API.md) | 28 endpoints, auth flow, error model, shared Zod contracts. |
| [FRONTEND.md](FRONTEND.md) | Per-screen wiring, signal-store and typed-form patterns to copy. |
| [REPORT.md](REPORT.md) | ER diagram, DFD levels 0-2, report chapters, test-case table, screenshots. |
| [schema.prisma](schema.prisma) | Documentation model of record. NOT the runtime layer — `db/schema.sql` is executable truth. |

## Standing decisions

- **MySQL 8**, raw `mysql2` with parameterised queries. Prisma is a documentation artifact only
  (`prisma db pull` → `prisma-erd-generator` → ER diagram).
- **Single origin.** Express serves the built Angular app; production CORS does not exist.
- **Polling, not WebSockets.** Correctness comes from a database constraint, not a socket.
- **Delete dead buttons, never leave them inert.** An examiner clicks everything.
- **The API contract is the single source of truth** for endpoint paths. Nothing else.

## Never cut

Day 0 deletion commit · `db/schema.sql` · `db/seed.sql` · auth and guards ·
the submit-request wizard · `/requests/:id` · the Accept button · the atomic claim
transaction · the status dialog · feedback · the ER diagram · the DFDs · the report.
