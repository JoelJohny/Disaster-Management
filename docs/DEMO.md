# Viva Demo Script

The whole build serves this click-path. Every step lands on something that works.

---

**1.** PRE-FLIGHT, 30 MINUTES BEFORE, REHEARSED THREE TIMES: 'docker compose down -v && docker compose up -d' for a clean seeded database, 'npm run build && npm start', one Node process on http://localhost:3000. Because the session is one httpOnly same-origin cookie, ONE browser profile holds ONE session — open FOUR contexts and pre-log-in: Chrome normal = ADMIN, Chrome incognito = VICTIM Priya (Ernakulam), Edge normal = VOLUNTEER Arun, Edge incognito = VOLUNTEER Meera. Also open: Adminer on :8080 with the assignments table DDL on screen, one terminal in backend/ with the race-test command typed but not run, and the ER diagram in a PDF tab.

**2.** 1. Adminer, 30 seconds. Show the 10 tables. Open assignments and point at the active_help_request_id generated column and uq_one_active_assignment. This pre-empts the examiner's first question — 'is the database real?' — before they ask it.

**3.** 2. Login page, wrong password first. Inline red error, no navigation, no crash. Then type ' OR '1'='1 into the email field — rejected by validation. Say the words: parameterised queries via mysql2 placeholders, bcrypt hashing, generic error message so there is no user enumeration.

**4.** 3. Register a brand-new victim in front of them. Mistype the confirm password deliberately so the cross-field match validator fires on screen, then fix it and submit. Flip to Adminer and show the new users row with terms_accepted_at populated.

**5.** 4. Log in as Priya (Chrome incognito). /victim/dashboard in disaster-relief vocabulary: 'Kerala Floods 2025 — SEVERE — ACTIVE in Ernakulam' with the event helpline, her open-request count, the nearest OPEN shelter card ('Govt. HSS Aluva — 2.4 km — 180/300'), and one large red SOS button. Say out loud that this copy replaced the victim-services vocabulary the template shipped with.

**6.** 5. Submit a Help Request. Press Next on step 1 with nothing selected — step validation blocks it with an inline message. Do this deliberately; it proves the form is bound. Then fill it: Medical Assistance, CRITICAL, district Ernakulam, 'near Aluva Metro Station', 4 people, description.

**7.** 6. Submit. Toast, then redirect to /requests/:id showing reference REQ-2026-000046, status SUBMITTED, and a one-row timeline. Mention that this single screen retired the eight dead 'View Details' buttons the original app had.

**8.** 7. Go to My Requests. New row at the top. Click through the five filter pills and point out the per-status counts came from the server envelope, not from filtering an array in the browser, and that pagination is over 45 seeded requests.

**9.** 8. THE RBAC BEAT — do not skip it, it is the highest-scoring 45 seconds. Still as Priya, paste /admin/user-management into the address bar: bounced to a real Forbidden page. Then paste another victim's request id: 403. Then in the terminal, curl the admin API with Priya's cookie: 403 JSON. Say it in one breath — 'the hidden sidebar is UX, this is the security; requireAuth is mounted on the entire /api/v1 router with an explicit public allowlist, so a route I forget to protect fails closed.'

**10.** 9. ADMIN window. User Management: search 'arun' to show debounced server-side search, then find the volunteer sitting at approval_status PENDING and Approve him. 'Open self-registration would otherwise hand any stranger a geolocated list of isolated households with phone numbers.' Then try to deactivate your own admin account: blocked with a reason.

**11.** 10. VOLUNTEER Arun (Edge normal). Available Requests. The CRITICAL medical request is at the top, sorted by urgency, showing a real '2.4 km away' from ST_Distance_Sphere. POINT AT THE MISSING PHONE NUMBER: 'Victim — contact released on acceptance'. No name, no phone, no exact address yet.

**12.** 11. THE MONEY MOMENT, PART ONE. Meera (Edge incognito) is already sitting on the same card. Click Accept in both windows within a second. Arun gets the task; Meera gets 'Already accepted by Arun K.' Flip to Adminer: exactly one active assignment row for that request.

**13.** 12. THE MONEY MOMENT, PART TWO. Terminal: run scripts/race-test.mjs — ten parallel claims against one request printing '1 x 201 ACCEPTED, 9 x 409 ALREADY_CLAIMED'. Then back to the assignments DDL and explain in thirty seconds: MySQL has no partial indexes, so the column is NULL unless the assignment is live, MySQL treats NULLs in a UNIQUE index as distinct, so unlimited closed rows coexist with at most one open one — and the constraint lives in the database, not in an if-statement. Expect a follow-up question here; that is the point.

**14.** 13. Back in PRIYA'S WINDOW WITHOUT TOUCHING ANYTHING. Within 15 seconds the bell lights up with 'A volunteer has been assigned to your request'. Click it — it deep-links to /requests/:id, where the timeline now reads SUBMITTED then ASSIGNED with timestamps and actor names, and Arun's name and phone are now visible to her. If the poll is mid-cycle, hit the manual Refresh button; never stand in silence.

**15.** 14. VOLUNTEER Arun. Open the status dialog and attempt ASSIGNED -> COMPLETED directly: the server returns 400 on the illegal transition. Then walk it properly — IN_PROGRESS with progress dragged to 50%, then Completed with hours_logged 2.5 and a completion note. Note that his victim-contact panel became visible only at acceptance.

**16.** 15. PRIYA. My Requests, Refresh. Status is COMPLETED and a 'Give Feedback' button has appeared. Open /victim/feedback/46, submit 5 stars and a comment. Then navigate back and submit again: 409 'Feedback already submitted'. 'One feedback per request is a UNIQUE index, not an if-statement in my service.'

**17.** 16. ADMIN. All Requests: filter status=Completed and type=Medical Assistance, show the request with Assigned To = Arun K., then open the Assign dialog on a different SUBMITTED request and assign it — same claim service, assigned_by set. Then the Admin Dashboard: 'Resolved Today' has incremented, today's bar in the 7-day trend has grown, the activity feed shows all five transitions you just generated with real actors and timestamps, and Arun's rating average has moved.

**18.** 17. ADMIN. Disaster Events: four events showing ACTIVE / UPCOMING / PAST derived live from dates, never stored — the original mock data contradicted itself precisely because status was stored. Create 'Cyclone Ditwah 2026', Ernakulam, radius 40 km. Then submit one more request from Priya's window and show it auto-attached to the new event on the detail screen.

**19.** 18. ADMIN. Reports -> Help Request Summary, last 7 days: on-screen counts-by-type-by-status table, then Download CSV, then open the CSV in Excel.

**20.** 19. CLOSE IN THE TERMINAL, NOT ON A SCREEN. Run 'npm test' in backend/: twelve green Supertest cases. Point at the concurrent-claim test and the cross-victim-403 test by name. Then put the ER diagram beside Adminer and say: 'ten tables, third normal form, and every one of them was written to or read from by something you just watched.'

---

## Talking points

- The double-dispatch guarantee, and why it is a DATABASE constraint rather than application code: MySQL has no filtered or partial indexes, so a STORED generated column equals help_request_id while the assignment is live and is NULL once it is not, with a plain UNIQUE index on it. MySQL treats NULLs in a UNIQUE index as distinct, so unlimited closed assignments coexist with at most one open one. Even if a future code path forgets the transaction, the database still refuses. Have the DDL on screen.
- Why the claim uses SELECT ... FOR UPDATE and a unique index together: the row lock wins the race in practice and produces a clean 409 with the winner's name; the index guarantees the invariant regardless of the code path. Belt and braces, and the belt is the one that survives a refactor.
- assignments is an associative entity resolving the M:N between help_requests and volunteers, carrying its own attributes — claimed_at, status, progress_pct, hours_logged, completion_notes. That is the many-to-many the examiner is looking for, and it is load-bearing rather than decorative.
- Why disaster_events.status is DERIVED in SQL and help_requests.status is STORED. Event status is a pure function of start_date, end_date and now(), so storing it guarantees drift — and the original mock data proved it by labelling a past-dated event 'Upcoming'. Request status is not derivable; it is a record of decisions people made, so it is stored and every change is appended to request_status_events.
- Why request_type is a lookup TABLE but request status is a MySQL ENUM. The asymmetry is deliberate: statuses are a closed set the code branches on, while an administrator must be able to add a relief category without an ALTER TABLE and a redeploy.
- Normalisation to 3NF with a concrete before and after: icon and iconBgColor moved off the request into request_types because presentation was being stored as data; assignedTo:string promoted to a first-class assignments entity; status history moved into its own append-only table instead of a single updated_at column.
- Deny-by-default authorization. requireAuth is mounted on the entire /api/v1 router with an explicit public allowlist, so the failure mode of forgetting to protect a route is 401, not an open endpoint. Route guards are user experience; the server is the enforcement. Offer the curl proof unprompted.
- Progressive PII disclosure plus the volunteer approval gate. An approved volunteer browsing the pool sees type, urgency, headcount and district; the victim's name, phone and exact location are added to the payload by the serializer only after that volunteer's claim succeeds. Then the honest caveat: the approval gate creates a bottleneck precisely during a surge, and a real deployment needs a trusted-organisation bulk import. Naming your own design's weakness scores better than defending it. Cite DPDP Act 2023.
- Why polling, not WebSockets. Correctness lives in the unique index, not in the transport, so a stale list is harmless — the second claimant simply receives a 409. Fifteen-second polling paused on a hidden tab costs one interval and zero infrastructure, survives a sleeping laptop and a flaky venue network, and swapping in SSE later is a one-day change with zero schema impact.
- Why there is no CSRF token, as a decision rather than an omission: the SPA and the API are same-origin, the session cookie is SameSite=Lax, and every mutation is a non-GET request that Lax will not attach the cookie to cross-site. The day the API moves to a separate origin, SameSite becomes None and a double-submit token becomes mandatory.
- Distance without PostGIS: ST_Distance_Sphere on SRID-0 POINTs built from DECIMAL(9,6) columns, returning metres. MySQL's SRID 4326 is latitude-first while SRID 0 is longitude-first, the opposite of PostGIS — knowing that trap, and sidestepping it rather than handling it, is worth a mark on its own.
- Timestamps are DATETIME(3) storing UTC with the mysql2 connection pinned to +00:00 and formatted to IST at the Angular edge. MySQL's TIMESTAMP type silently converts by session timezone, which is a bug waiting for the first server that is not on IST.
- Why one /requests/:id screen serves three roles: one resource, one endpoint, role-based projection of the same DTO. Three near-identical screens would have been three places for the timeline to drift out of sync.
- Integrity guards enforced in the database and the service rather than the UI: cannot deactivate yourself, cannot remove the last ADMIN, users holding request history are deactivated and never deleted, one feedback per request, peopleCount >= 1, description length >= 10.
- Raw parameterised SQL over an ORM, chosen deliberately: every query is visible, the DDL lives in one file, injection is handled by mysql2 placeholders, and the generated-column unique index needed no escape hatch. The trade-off is repository boilerplate, which is acceptable at ten tables.
- There are no Angular unit tests and twelve backend integration tests, on purpose. A test asserting that a component renders an <h1> catches nothing; a test firing ten concurrent claims at one request and asserting exactly one 201 catches the class of bug that actually harms someone.
- Exactly what was left out and why — SMS (TRAI DLT is a one-to-three-week regulatory item requiring a registered entity and per-template pre-approval, not engineering work), photo storage, maps, email, i18n, refresh-token rotation. Being able to enumerate nine deliberately-dropped entities with a reason for each is the strongest single move available in a viva; 'I ran out of time' throws the same mark away.
