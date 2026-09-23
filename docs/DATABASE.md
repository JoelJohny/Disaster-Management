# Database Design — MySQL 8

Ten tables, 13 enums. Third normal form.

---

## Atomic claim — the double-dispatch guarantee

MECHANISM — TWO INDEPENDENT LAYERS, DELIBERATELY.

Layer 1 (the belt, wins the race cleanly and produces a friendly message): a row lock on the help request.
Layer 2 (the braces, survives any future refactor): a UNIQUE index in the database that cannot be bypassed by any code path, including the admin Assign dialog, a script, or Adminer.

--- THE DDL (db/schema.sql, verbatim) ---

CREATE TABLE assignments (
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  help_request_id          BIGINT UNSIGNED NOT NULL,
  volunteer_user_id        BIGINT UNSIGNED NOT NULL,
  assigned_by_user_id      BIGINT UNSIGNED NULL,
  status                   ENUM('ASSIGNED','IN_PROGRESS','AWAITING_CONFIRMATION','COMPLETED','RELEASED')
                             NOT NULL DEFAULT 'ASSIGNED',
  active_help_request_id   BIGINT UNSIGNED
                             GENERATED ALWAYS AS (
                               CASE WHEN status IN ('ASSIGNED','IN_PROGRESS','AWAITING_CONFIRMATION')
                                    THEN help_request_id ELSE NULL END
                             ) STORED,
  progress_pct             TINYINT UNSIGNED NOT NULL DEFAULT 0,
  hours_logged             DECIMAL(5,2) NULL,
  completion_notes         VARCHAR(500) NULL,
  claimed_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at               DATETIME(3) NULL,
  awaiting_confirmation_at DATETIME(3) NULL,
  completed_at             DATETIME(3) NULL,
  released_at              DATETIME(3) NULL,
  updated_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_one_active_assignment (active_help_request_id),
  KEY ix_as_volunteer_status (volunteer_user_id, status),
  KEY ix_as_request_claimed  (help_request_id, claimed_at),
  KEY ix_as_completed_at     (completed_at),
  KEY ix_as_assigner         (assigned_by_user_id),
  CONSTRAINT fk_as_request   FOREIGN KEY (help_request_id)     REFERENCES help_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_as_volunteer FOREIGN KEY (volunteer_user_id)   REFERENCES users(id)         ON DELETE RESTRICT,
  CONSTRAINT fk_as_assigner  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)         ON DELETE SET NULL,
  CONSTRAINT ck_as_progress  CHECK (progress_pct <= 100),
  CONSTRAINT ck_as_hours     CHECK (hours_logged IS NULL OR (hours_logged >= 0 AND hours_logged <= 24))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

Ordering note: help_request_id and status are declared BEFORE the generated column that reads them. No FK on active_help_request_id — MySQL does not permit foreign-key actions on a generated column, and none is needed because fk_as_request already constrains the base column.

--- WHY THIS ENFORCES EXACTLY ONE ACTIVE ASSIGNMENT PER REQUEST (the 30-second proof) ---

Let ACTIVE = {ASSIGNED, IN_PROGRESS, AWAITING_CONFIRMATION}.
1. For any row r, active_help_request_id(r) = help_request_id(r) if status(r) IN ACTIVE, else NULL. It is STORED, so InnoDB recomputes and re-indexes it on every INSERT and on every UPDATE that touches status or help_request_id.
2. Suppose two rows r1 != r2 both have help_request_id = H and status IN ACTIVE. Then active_help_request_id(r1) = active_help_request_id(r2) = H, a non-NULL duplicate in uq_one_active_assignment. InnoDB rejects it. Therefore at most one active assignment per request. QED.
3. Closed rows (COMPLETED, RELEASED) store NULL, and the SQL standard — which MySQL follows here — treats NULLs in a unique index as mutually distinct. So a request may accumulate unlimited historical assignments while never having more than one open one. This is the property a naive `UNIQUE (help_request_id)` would destroy, and it is exactly what the Postgres partial index bought.
4. The guarantee holds on UPDATE too, not just INSERT: an admin trying to flip a RELEASED row back to ASSIGNED while another volunteer holds the request gets the same 1062.
5. It holds with no transaction at all, from any client. That is the whole point: the constraint lives in the database, not in an if-statement.

--- VERIFY THIS IN THE FIRST 20 MINUTES OF WEEK 1, BEFORE ANY ENDPOINT DEPENDS ON IT ---
(Docker's daemon was down at design time, so this is unrun: `docker pull mysql:8.0` this week, not on demo morning.)

docker compose up -d mysql
docker compose exec mysql mysql -uroot -proot drms -e "
  INSERT INTO assignments (help_request_id, volunteer_user_id, status) VALUES (1, 2, 'ASSIGNED');
  -- expect ERROR 1062: second active claim on the same request
  INSERT INTO assignments (help_request_id, volunteer_user_id, status) VALUES (1, 3, 'ASSIGNED');
"
docker compose exec mysql mysql -uroot -proot drms -e "
  UPDATE assignments SET status='COMPLETED' WHERE help_request_id=1;
  -- must now SUCCEED: the slot was freed because the generated column went NULL
  INSERT INTO assignments (help_request_id, volunteer_user_id, status) VALUES (1, 3, 'ASSIGNED');
  -- and a second historical row must coexist
  SELECT id, status, active_help_request_id FROM assignments WHERE help_request_id=1;
"
Expected: insert 1 OK, insert 2 ERROR 1062, after the UPDATE insert 3 OK, final SELECT shows two rows, one with active_help_request_id = 1 and one with NULL.

--- THE CLAIM TRANSACTION (backend/src/services/claim.service.ts, one mysql2 pool connection) ---

// preconditions checked before the transaction: requireAuth, requireRole(VOLUNTEER|ADMIN),
// and volunteer_profiles.approval_status = 'APPROVED' (else 403 with the banner message).
await conn.query("SET SESSION innodb_lock_wait_timeout = 5");
await conn.beginTransaction();
try {
  // 1. CURRENT READ + row lock. Under REPEATABLE READ a plain SELECT would read a stale
  //    snapshot; FOR UPDATE reads the latest committed row and blocks every rival here.
  const [[req]] = await conn.query(
    "SELECT id, status, submitted_by_user_id, district FROM help_requests WHERE id = ? FOR UPDATE",
    [helpRequestId]
  );
  if (!req)                      { await conn.rollback(); return notFound(); }
  if (req.status !== 'SUBMITTED'){ await conn.rollback(); return alreadyClaimed(helpRequestId); }

  // 2. INSERT the assignment. uq_one_active_assignment is the backstop if step 1 is ever
  //    bypassed by a future code path; ER_DUP_ENTRY is caught below.
  const [ins] = await conn.query(
    "INSERT INTO assignments (help_request_id, volunteer_user_id, assigned_by_user_id, status, claimed_at) " +
    "VALUES (?, ?, ?, 'ASSIGNED', UTC_TIMESTAMP(3))",
    [helpRequestId, volunteerUserId, assignedByUserId ?? null]   // assignedByUserId set only from the admin dialog
  );
  const assignmentId = ins.insertId;                              // MySQL has no RETURNING

  // 3. Advance the request.
  await conn.query(
    "UPDATE help_requests SET status = 'ASSIGNED', " +
    "first_assigned_at = COALESCE(first_assigned_at, UTC_TIMESTAMP(3)) WHERE id = ?",
    [helpRequestId]
  );

  // 4. Append to the immutable timeline (drives /requests/:id AND the admin activity feed).
  await conn.query(
    "INSERT INTO request_status_events (help_request_id, from_status, to_status, actor_user_id, actor_role, occurred_at) " +
    "VALUES (?, 'SUBMITTED', 'ASSIGNED', ?, ?, UTC_TIMESTAMP(3))",
    [helpRequestId, actorUserId, actorRole]
  );

  // 5. Notify the victim — same transaction, so the bell can never light up for a claim
  //    that rolled back, and can never fail to light up for one that committed.
  await conn.query(
    "INSERT INTO notifications (recipient_user_id, type, title, body, help_request_id, created_at) " +
    "VALUES (?, 'REQUEST_ASSIGNED', 'A volunteer has been assigned to your request', ?, ?, UTC_TIMESTAMP(3))",
    [req.submitted_by_user_id, `${volunteerFirstName} has accepted your request and will contact you shortly.`, helpRequestId]
  );

  await conn.commit();
  return { status: 201, assignmentId };
} catch (e) {
  await conn.rollback();
  if (e.errno === 1062 && String(e.message).includes('uq_one_active_assignment')) return alreadyClaimed(helpRequestId);
  if (e.errno === 1205 || e.errno === 1213) return alreadyClaimed(helpRequestId);  // lock timeout / deadlock
  throw e;
} finally { conn.release(); }

--- WHAT THE LOSER SEES ---

Meera's request blocks on the FOR UPDATE at step 1 for the few milliseconds Arun's transaction holds the lock. When Arun commits, Meera's lock is granted, her CURRENT READ returns status = 'ASSIGNED', and she takes the `!== 'SUBMITTED'` branch. alreadyClaimed() then does one read outside the transaction to name the winner:

  SELECT u.first_name, LEFT(u.last_name,1) AS last_initial
    FROM assignments a JOIN users u ON u.id = a.volunteer_user_id
   WHERE a.active_help_request_id = ?;      -- unique-index lookup, at most one row

and returns HTTP 409:
  { "error": { "code": "ALREADY_CLAIMED",
               "message": "Already accepted by Arun K.",
               "helpRequestId": 46 } }

The Angular error interceptor maps 409 to a toast, the available-requests facade removes the card from the signal, and no navigation happens. If the FOR UPDATE path is ever bypassed — the admin Assign dialog racing a self-claim, a direct INSERT, a future refactor — the identical 409 is produced from the ER_DUP_ENTRY branch instead. Same response, two independent reasons, which is the sentence to say out loud at demo step 12.

--- THE RACE TEST (scripts/race-test.mjs, and backend integration test 8 of 12) ---

const r = await Promise.all(Array.from({length: 10}, () =>
  fetch(`${BASE}/api/v1/requests/${id}/claim`, { method: 'POST', headers: { cookie: volunteerCookie } })
));
// assert: exactly one 201, exactly nine 409 ALREADY_CLAIMED
// assert: SELECT COUNT(*) FROM assignments WHERE active_help_request_id = ? --> 1
// assert: SELECT COUNT(*) FROM request_status_events WHERE help_request_id = ? AND to_status='ASSIGNED' --> 1
// assert: SELECT COUNT(*) FROM notifications WHERE help_request_id = ? AND type='REQUEST_ASSIGNED' --> 1

The last two assertions matter as much as the first: they prove the whole transaction rolled back as a unit, not just the assignment insert.

--- RELEASE / CANCEL PATHS THAT KEEP THE INVARIANT HONEST ---
Victim cancel is permitted only while status = 'SUBMITTED' (no active assignment exists, nothing to release). Admin cancel on an assigned request runs one transaction: UPDATE assignments SET status='RELEASED', released_at=UTC_TIMESTAMP(3) WHERE active_help_request_id = ?; UPDATE help_requests SET status='CANCELLED', cancelled_at=...; plus the status event and notifications. The generated column goes NULL on the first statement, so the slot is free the instant the transaction commits and the request could legitimately be re-opened later.

---

## Tables

### users

One identity for all three roles. Kills the three contradictory hardcoded people (Welcome Jane / Jane Doe Victim / John Doe Administrator) and every placehold.co avatar. Reconciles registration's firstName+lastName with user-profile's single `name` (displayed as CONCAT at read time, not stored).

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY — clustered, monotonic, ORDER BY id DESC is free 'newest first'
  email VARCHAR(191) NOT NULL UNIQUE — utf8mb4_0900_ai_ci makes uniqueness case-insensitive for free (no citext needed); still lowercased at the API boundary
  password_hash CHAR(60) NOT NULL — bcryptjs cost 12 output is exactly 60 chars
  first_name VARCHAR(60) NOT NULL
  last_name VARCHAR(60) NOT NULL
  phone VARCHAR(20) NULL UNIQUE — MySQL allows unlimited NULLs in a UNIQUE index, which is Postgres's `UNIQUE ... WHERE phone IS NOT NULL` for free
  role ENUM('ADMIN','VOLUNTEER','VICTIM') NOT NULL DEFAULT 'VICTIM' — self-registration may only create VICTIM or VOLUNTEER
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE' — the admin table's green/red dot; users with history are deactivated, never deleted
  home_district ENUM(14 Kerala districts) NULL — the seeded dropdown that replaces browser GPS
  home_lat DECIMAL(9,6) NULL — volunteer sort origin, victim shelter-card origin, SOS coordinates
  home_lng DECIMAL(9,6) NULL
  token_version INT UNSIGNED NOT NULL DEFAULT 0 — bumped to revoke every outstanding JWT (logout-everywhere, deactivation)
  terms_accepted_at DATETIME(3) NULL — the registration checkbox, collapsed from a whole consent table (DPDP Act 2023 paragraph in System Analysis)
  terms_version VARCHAR(20) NULL — e.g. '2026-01-v1'
  last_login_at DATETIME(3) NULL
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) — replaces the pre-formatted 'Jan 15, 2024' display string
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
```

**Indexes**

- `uq_users_email UNIQUE (email)`
- `uq_users_phone UNIQUE (phone)`
- `ix_users_role_status (role, status) — admin user-management filter + 'last ADMIN' guard`
- `ix_users_name (last_name, first_name) — LIKE 'arun%' debounced search can range-scan this`
- `ix_users_created_at (created_at) — Total Users KPI / registrations over time`

### volunteer_profiles

Volunteer-only attributes kept off users so the core table stays lean. Carries the approval gate (without which self-registration hands any stranger a geolocated list of isolated households with phone numbers) and the three denormalised KPI aggregates that give the volunteer dashboard a source for the first time.

```
  user_id BIGINT UNSIGNED PRIMARY KEY — PK is also the FK; a true 1:1, and the ER diagram shows it as such
  approval_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING' — the claim endpoint hard-rejects anything but APPROVED with 403
  approved_by_user_id BIGINT UNSIGNED NULL — which admin approved
  approved_at DATETIME(3) NULL
  rejection_reason VARCHAR(255) NULL
  organisation VARCHAR(120) NULL — NGO affiliation
  service_radius_km SMALLINT UNSIGNED NOT NULL DEFAULT 15 — CHECK BETWEEN 1 AND 100; bounds 'Available Nearby'
  rating_avg DECIMAL(3,2) NULL — seeded history; live feedback writes it, nothing recomputes the past
  rating_count INT UNSIGNED NOT NULL DEFAULT 0
  completed_count INT UNSIGNED NOT NULL DEFAULT 0 — 'Completed This Month' KPI base
  hours_logged DECIMAL(7,2) NOT NULL DEFAULT 0 — the ONLY source for 'Hours Contributed'; written live at task completion
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
```

**Indexes**

- `PRIMARY (user_id)`
- `ix_vp_approval_status (approval_status) — the admin approval queue`
- `ix_vp_approver (approved_by_user_id) — required by MySQL for the FK anyway`

**Foreign keys**

- fk_vp_user (user_id) -> users(id) ON DELETE CASCADE
- fk_vp_approver (approved_by_user_id) -> users(id) ON DELETE SET NULL

### request_types

Server-driven lookup replacing four hardcoded and already-out-of-sync <option> lists (the admin filter omits 'Rescue / Evacuation' that the mock data contains). Also the home for presentation keys, which finally moves icon:any and iconBgColor:'bg-red-500' off the data model — a concrete before/after for the 3NF section of the report.

```
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  code VARCHAR(20) NOT NULL UNIQUE — MEDICAL | FOOD_WATER | SHELTER | RESCUE | OTHER
  label VARCHAR(60) NOT NULL — 'Medical Assistance', 'Food & Water', 'Shelter / Housing', 'Rescue / Evacuation', 'Other'
  icon_key VARCHAR(40) NOT NULL — 'heartbeat','utensils','home','truck','question-circle'; the client maps this to a FontAwesome IconDefinition because JSON cannot carry an icon object
  color_key VARCHAR(20) NOT NULL — 'red','green','blue','purple','gray'; the client maps this to Tailwind classes
  sort_order TINYINT UNSIGNED NOT NULL — dropdown order, server-controlled
  is_active TINYINT(1) NOT NULL DEFAULT 1 — MySQL has no BOOLEAN; TINYINT(1) is the alias
```

**Indexes**

- `uq_request_types_code UNIQUE (code)`
- `ix_request_types_active_sort (is_active, sort_order)`

### disaster_events

The campaign relief work is organised under — the link that currently does not exist anywhere in the codebase, which is why 'organize relief efforts' is an empty promise. Status is DERIVED in SQL, never stored: the shipped mock data is self-contradictory precisely because it was stored (a past-dated event labelled 'Upcoming').

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  name VARCHAR(120) NOT NULL — 'Kerala Floods 2025'
  type ENUM('FLOOD','CYCLONE','LANDSLIDE','EARTHQUAKE','FIRE','DROUGHT','OTHER') NOT NULL
  severity ENUM('LOW','MODERATE','SEVERE','CATASTROPHIC') NOT NULL — declaration order is severity order, so ORDER BY severity DESC needs no CASE
  district ENUM(14 Kerala districts) NULL — NULL for out-of-state fixtures (Cyclone Remal / Uttarakhand) so the real mock data survives
  location_text VARCHAR(120) NOT NULL — 'Kerala, India', 'West Bengal, India'
  center_lat DECIMAL(9,6) NOT NULL — centre + radius replaces a PostGIS polygon boundary
  center_lng DECIMAL(9,6) NOT NULL
  radius_km SMALLINT UNSIGNED NOT NULL DEFAULT 25 — CHECK BETWEEN 1 AND 500; the auto-attach catchment
  helpline_number VARCHAR(20) NULL — makes the victim dashboard's event card load-bearing rather than decorative
  description TEXT NULL
  start_date DATETIME(3) NOT NULL
  end_date DATETIME(3) NULL — UI renders 'Ongoing'; CHECK (end_date IS NULL OR end_date > start_date)
  created_by_user_id BIGINT UNSIGNED NOT NULL
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  -- NO status COLUMN. Derived: CASE WHEN start_date > NOW() THEN 'UPCOMING' WHEN end_date IS NOT NULL AND end_date < NOW() THEN 'PAST' ELSE 'ACTIVE' END
```

**Indexes**

- `ix_de_dates (start_date, end_date) — the derived-status list query`
- `ix_de_creator (created_by_user_id)`

**Foreign keys**

- fk_de_creator (created_by_user_id) -> users(id) ON DELETE RESTRICT

### shelters

Seeded, read-only, 8 rows. Feeds the 'nearest open shelter' card on the victim dashboard (a hard owner-made product constraint) and one plain admin table. The nullable event FK exists so the ER diagram has no orphan island. No CRUD, no occupancy editing.

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  name VARCHAR(120) NOT NULL — 'Govt. HSS Aluva'
  district ENUM(14 Kerala districts) NOT NULL
  address_text VARCHAR(200) NOT NULL
  lat DECIMAL(9,6) NOT NULL — real coordinates, so the km figure on the dashboard is genuinely computed
  lng DECIMAL(9,6) NOT NULL
  capacity SMALLINT UNSIGNED NOT NULL — CHECK capacity > 0
  current_occupancy SMALLINT UNSIGNED NOT NULL DEFAULT 0 — CHECK current_occupancy <= capacity; renders '180/300'
  status ENUM('OPEN','FULL','CLOSED') NOT NULL DEFAULT 'OPEN'
  contact_phone VARCHAR(20) NULL
  disaster_event_id BIGINT UNSIGNED NULL
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
```

**Indexes**

- `ix_sh_district_status (district, status) — 'nearest OPEN shelter in my district'`
- `ix_sh_event (disaster_event_id)`

**Foreign keys**

- fk_sh_event (disaster_event_id) -> disaster_events(id) ON DELETE SET NULL

### help_requests

The centre of the application and the single canonical reconciliation of FOUR incompatible frontend declarations (admin all-requests, victim request-status, volunteer AvailableRequest, volunteer AssignedRequest). Everything the 3-step wizard collects now has somewhere to land AND is displayed back, which is impossible today. All presentation fields (icon, iconBgColor, timeAgo, distance, 'Aug 25, 2025') are gone.

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY — the only key; the human reference is computed at read time
  submitted_by_user_id BIGINT UNSIGNED NOT NULL — replaces admin's display-name-only `submittedBy: string` with a real FK
  request_type_id SMALLINT UNSIGNED NOT NULL — replaces `type: string` and the icon/colour columns
  disaster_event_id BIGINT UNSIGNED NULL — auto-attached on insert to the nearest ACTIVE event whose radius contains the point
  urgency ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM' — the wizard's four values win; removing CRITICAL to match a stale admin table would be the wrong direction of reconciliation. Ordinal order = priority order
  status ENUM('SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SUBMITTED' — 'Pending Confirmation' deliberately lives on assignments, not here: it is a fact about a volunteer's handoff, not about the request
  district ENUM(14 Kerala districts) NOT NULL — the wizard's seeded select; replaces free-text-only location
  location_text VARCHAR(200) NOT NULL — 'near Aluva Metro Station'; the landmark the victim typed
  lat DECIMAL(9,6) NOT NULL — home point when the victim's saved district matches, else the district centroid
  lng DECIMAL(9,6) NOT NULL
  location_source ENUM('HOME_POINT','DISTRICT_CENTROID','FIELD_REPORTED','ADMIN_ENTERED') NOT NULL DEFAULT 'DISTRICT_CENTROID' — honest precision labelling, and the sentence that answers 'how accurate is that 2.4 km?' in the viva
  people_count SMALLINT UNSIGNED NOT NULL — CHECK >= 1, the Zod rule the tests assert
  description TEXT NOT NULL — CHECK CHAR_LENGTH(description) >= 10
  contact_phone VARCHAR(20) NULL — the wizard's single 'phone OR email' field split into two typed columns at the API boundary
  contact_email VARCHAR(191) NULL
  source ENUM('WEB','SMS','IVR') NOT NULL DEFAULT 'WEB' — one column now means an SMS/IVR gateway is later an adapter, not a rewrite; TRAI DLT is documented as Future Scope
  cancel_reason VARCHAR(255) NULL
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) — a real UTC timestamp; timeAgo is computed client-side
  first_assigned_at DATETIME(3) NULL
  completed_at DATETIME(3) NULL — source for 'Resolved Today' and average completion time
  cancelled_at DATETIME(3) NULL
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  -- NO active_assignment_id: it would create a circular FK and MySQL has no deferrable constraints. LEFT JOIN the active assignment instead.
  -- NO reference column: a generated column may not reference an AUTO_INCREMENT column (error 3109). CONCAT('REQ-',YEAR(submitted_at),'-',LPAD(id,6,'0')) at read time.
```

**Indexes**

- `ix_hr_status_submitted (status, submitted_at DESC) — the volunteer available pool and every status-filtered list`
- `ix_hr_submitter_submitted (submitted_by_user_id, submitted_at DESC) — My Requests, ownership-scoped`
- `ix_hr_event_status (disaster_event_id, status)`
- `ix_hr_type_status (request_type_id, status) — the report's type x status cross-tab`
- `ix_hr_district_status (district, status)`
- `ix_hr_submitted_at (submitted_at) — the 7-day trend GROUP BY DATE(submitted_at)`
- `ix_hr_completed_at (completed_at) — 'Resolved Today'`

**Foreign keys**

- fk_hr_submitter (submitted_by_user_id) -> users(id) ON DELETE RESTRICT
- fk_hr_type (request_type_id) -> request_types(id) ON DELETE RESTRICT
- fk_hr_event (disaster_event_id) -> disaster_events(id) ON DELETE SET NULL

### request_status_events

Append-only status timeline, one INSERT per transition inside the same transaction as the transition itself. ONE table feeds four graded surfaces: the /requests/:id timeline, the notification content, the admin Recent System Activity feed and the summary report. This is why the separate audit_logs table was cut — request_status_events JOIN users already answers who-did-what-when for the entity that matters.

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY — monotonic, so ORDER BY id is chronological and no extra sort index is needed
  help_request_id BIGINT UNSIGNED NOT NULL
  from_status ENUM(5 request statuses) NULL — NULL on the initial SUBMITTED row
  to_status ENUM(5 request statuses) NOT NULL
  actor_user_id BIGINT UNSIGNED NULL — NULL when system-generated
  actor_role ENUM('ADMIN','VOLUNTEER','VICTIM') NULL — snapshotted so a later role change does not rewrite history
  note VARCHAR(255) NULL — cancellation reason, completion note, admin remark
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  -- GRANT: application DB user holds INSERT, SELECT only on this table. Tamper-evidence by privilege, not by convention.
```

**Indexes**

- `ix_rse_request_time (help_request_id, occurred_at) — the timeline`
- `ix_rse_time (occurred_at DESC) — the admin activity feed`
- `ix_rse_actor (actor_user_id)`

**Foreign keys**

- fk_rse_request (help_request_id) -> help_requests(id) ON DELETE CASCADE
- fk_rse_actor (actor_user_id) -> users(id) ON DELETE SET NULL

### assignments

The associative entity resolving the M:N between help_requests and volunteers, carrying its own attributes (claimed_at, status, progress_pct, hours_logged, completion_notes). Promoted out of the denormalised `assignedTo?: string` display name. This is where the claim race is won, where every volunteer KPI comes from, and where AWAITING_CONFIRMATION lives — resolving the three-way status-vocabulary conflict, because the two vocabularies were describing two different entities all along.

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  help_request_id BIGINT UNSIGNED NOT NULL — MUST be declared before the generated column that references it
  volunteer_user_id BIGINT UNSIGNED NOT NULL — service layer additionally requires volunteer_profiles.approval_status = 'APPROVED'
  assigned_by_user_id BIGINT UNSIGNED NULL — NULL when self-claimed from the pool, set to the admin id when assigned from all-requests through the SAME claim service
  status ENUM('ASSIGNED','IN_PROGRESS','AWAITING_CONFIRMATION','COMPLETED','RELEASED') NOT NULL DEFAULT 'ASSIGNED' — MUST be declared before the generated column
  active_help_request_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('ASSIGNED','IN_PROGRESS','AWAITING_CONFIRMATION') THEN help_request_id ELSE NULL END) STORED — the double-dispatch guarantee. NO foreign key on it. Never written by application code (MySQL error 3105 if you try).
  progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0 — CHECK <= 100; the progress bar becomes writable for the first time
  hours_logged DECIMAL(5,2) NULL — CHECK BETWEEN 0 AND 24; required by the server on transition to COMPLETED. The only live write path feeding 'Hours Contributed'
  completion_notes VARCHAR(500) NULL
  claimed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) — replaces the 'Accepted on Aug 25, 2025' display string
  started_at DATETIME(3) NULL
  awaiting_confirmation_at DATETIME(3) NULL
  completed_at DATETIME(3) NULL
  released_at DATETIME(3) NULL — set when an admin cancels a request out from under an active assignment; frees the unique slot automatically
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
```

**Indexes**

- `uq_one_active_assignment UNIQUE (active_help_request_id) — THE SINGLE MOST IMPORTANT LINE IN THE SCHEMA`
- `ix_as_volunteer_status (volunteer_user_id, status) — My Tasks, scoped and indexed`
- `ix_as_request_claimed (help_request_id, claimed_at) — assignment history for the detail timeline`
- `ix_as_completed_at (completed_at) — 'Completed This Month'`
- `ix_as_assigner (assigned_by_user_id)`

**Foreign keys**

- fk_as_request (help_request_id) -> help_requests(id) ON DELETE RESTRICT
- fk_as_volunteer (volunteer_user_id) -> users(id) ON DELETE RESTRICT — this is the constraint that makes 'users holding history are deactivated, never deleted' a database fact, not a policy
- fk_as_assigner (assigned_by_user_id) -> users(id) ON DELETE SET NULL

### feedback

Victim rating of the support received. One per request, enforced by a UNIQUE index rather than an if-statement in a service — the demo submits twice and shows the 409 coming from ER_DUP_ENTRY. Reachable for the first time via /victim/feedback/:requestId, because today there is literally no path from a completed request to rating it.

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  help_request_id BIGINT UNSIGNED NOT NULL UNIQUE — the whole point
  assignment_id BIGINT UNSIGNED NULL UNIQUE — which volunteer engagement is being rated
  submitted_by_user_id BIGINT UNSIGNED NOT NULL — service enforces this equals help_requests.submitted_by_user_id AND status = 'COMPLETED'
  volunteer_user_id BIGINT UNSIGNED NULL — denormalised from the assignment so the rating aggregate is one query, not two joins
  rating TINYINT UNSIGNED NOT NULL — CHECK BETWEEN 1 AND 5
  comments TEXT NULL
  contact_permission TINYINT(1) NOT NULL DEFAULT 0 — 'A volunteer or admin may contact me about this feedback'
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
```

**Indexes**

- `uq_feedback_help_request UNIQUE (help_request_id)`
- `uq_feedback_assignment UNIQUE (assignment_id)`
- `ix_fb_volunteer_rating (volunteer_user_id, rating) — AVG(rating) per volunteer`
- `ix_fb_author (submitted_by_user_id)`
- `ix_fb_created_at (created_at)`

**Foreign keys**

- fk_fb_request (help_request_id) -> help_requests(id) ON DELETE CASCADE
- fk_fb_assignment (assignment_id) -> assignments(id) ON DELETE SET NULL
- fk_fb_author (submitted_by_user_id) -> users(id) ON DELETE RESTRICT
- fk_fb_volunteer (volunteer_user_id) -> users(id) ON DELETE SET NULL

### notifications

Replaces the two hardcoded header rows ('New user registered', 'Server reboot complete' — admin-flavoured content currently shown to victims) and the permanently-lit red dot. Written inside the SAME transaction as every status change, which is why it costs ~2h rather than a subsystem. The victim's bell lighting up without a refresh is the single most impressive ten seconds in the demo.

```
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  recipient_user_id BIGINT UNSIGNED NOT NULL
  type ENUM('REQUEST_SUBMITTED','REQUEST_ASSIGNED','REQUEST_STATUS_CHANGED','REQUEST_COMPLETED','FEEDBACK_RECEIVED','VOLUNTEER_APPROVED') NOT NULL
  title VARCHAR(120) NOT NULL — 'A volunteer has been assigned to your request'
  body VARCHAR(255) NOT NULL
  help_request_id BIGINT UNSIGNED NULL — a REAL FK, not a polymorphic entity_type/entity_id pair; the deep link /requests/:id is derived from it, so no target_url column and no orphan edge on the ER diagram. NULL for VOLUNTEER_APPROVED.
  read_at DATETIME(3) NULL — NULL means unread; the real unread COUNT replacing the permanent red dot
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) — so '5 minutes ago' is computed, not frozen
```

**Indexes**

- `ix_nt_recipient_unread (recipient_user_id, read_at, created_at DESC) — serves both the 15s unread-count poll and the dropdown list from one index`
- `ix_nt_request (help_request_id)`

**Foreign keys**

- fk_nt_recipient (recipient_user_id) -> users(id) ON DELETE CASCADE
- fk_nt_request (help_request_id) -> help_requests(id) ON DELETE CASCADE

---

## MySQL-specific decisions

- PARTIAL / FILTERED UNIQUE INDEX — the one that matters. Postgres: `CREATE UNIQUE INDEX ... ON assignments (help_request_id) WHERE status IN (...)`. MySQL has no WHERE clause on an index. WORKAROUND: a STORED generated column `active_help_request_id` that equals help_request_id while the assignment is live and is NULL otherwise, with a plain `UNIQUE KEY uq_one_active_assignment (active_help_request_id)`. MySQL/InnoDB treats NULLs in a UNIQUE index as mutually distinct, so unlimited closed assignments coexist with at most one open one. Enforced on UPDATE as well as INSERT.
- ALTERNATIVE CONSIDERED AND REJECTED: MySQL 8.0.13+ functional key parts would express the same thing inline — `UNIQUE KEY ((CASE WHEN status IN (...) THEN help_request_id END))`. It is implemented as a HIDDEN virtual generated column, so it does not appear in DESCRIBE, in Adminer's column list, or in the MySQL Workbench EER diagram. Demo beat 1 and viva talking point 1 both depend on pointing at the column on screen. Chose the explicit STORED column for demonstrability.
- GENERATED COLUMN RESTRICTIONS. (a) The expression may not reference an AUTO_INCREMENT column — MySQL error 3109 — which is why help_requests has no stored `reference` column. (b) It may not use subqueries, NOW(), RAND() or any non-deterministic function. (c) It must be declared AFTER every base column it references, so help_request_id and status come first in the CREATE TABLE. (d) No foreign key on it (FK actions are not permitted on generated columns). (e) Any INSERT must name its columns explicitly — `INSERT INTO assignments VALUES (...)` or `INSERT ... SELECT *` raises error 3105 'The value specified for generated column is not allowed'. This also means the seed file must always use explicit column lists.
- NATIVE ENUM. Postgres CREATE TYPE makes one reusable type; MySQL ENUM is per-column, so RequestStatus is physically re-declared in help_requests and twice in request_status_events. Adding a value is an ALTER TABLE (cheap with ALGORITHM=INSTANT only if appended at the end — inserting a value in the middle renumbers existing rows). Upside exploited deliberately: MySQL sorts, compares and MIN/MAXes ENUM by declaration ordinal, so declaring LOW,MEDIUM,HIGH,CRITICAL makes `ORDER BY urgency DESC` the correct priority sort with no CASE expression, and `WHERE urgency >= 'HIGH'` works. Trap to know for the viva: that comparison is ordinal, not alphabetical.
- NO CREATE EXTENSION, NO citext. Workaround: the server default collation utf8mb4_0900_ai_ci is already case-insensitive, so `UNIQUE (email)` gives case-insensitive uniqueness for free with no extension. Caveat to state honestly: ai = accent-insensitive, so 'josé@x.com' collides with 'jose@x.com'; the API lowercases and trims on write anyway. Where case sensitivity is required (password_hash) the column is CHAR(60) and is only ever compared by bcrypt, never by SQL.
- NO PostGIS, NO geography type. Workaround: lat/lng as DECIMAL(9,6) (~11 cm resolution, exact decimal, no float drift) and distance via `ST_Distance_Sphere(POINT(lng,lat), POINT(?,?))/1000`. SRID TRAP, adopted from all three design passes: MySQL's SRID 4326 is LATITUDE-FIRST (opposite of PostGIS), while SRID 0 is longitude-first. Building POINT(lng,lat) with implicit SRID 0 is correct; passing the same arguments as SRID 4326 silently relocates Kerala into the Indian Ocean. Never construct 4326 points in this project.
- NO GiST / no KNN operator / no `<->`. ST_Distance_Sphere is a full-table-scan expression; MySQL's SPATIAL R-tree indexes only accelerate MBR predicates (MBRContains, ST_Within), never distance ordering. At 45 rows this is irrelevant. The documented growth path is a bounding-box prefilter on the indexed lat/lng columns (a cheap index range scan) before the exact sphere distance — the SQL is given in the raw supplements so the report can show the plan.
- NO DEFERRABLE CONSTRAINTS. This kills help_requests.active_assignment_id: FKs in both directions mean neither row can be inserted first, and mysqldump would need SET FOREIGN_KEY_CHECKS=0, which breaks the docker-entrypoint-initdb.d seed — the exact mechanism the 20-second demo reset depends on. Workaround: LEFT JOIN assignments ON assignments.active_help_request_id = help_requests.id, which is an index lookup on a unique key and therefore cheaper than the denormalised pointer would have been.
- AUTO_INCREMENT vs UUID — DECIDED: BIGINT UNSIGNED AUTO_INCREMENT. Reasons that are MySQL-specific: InnoDB tables are clustered on the primary key, so a random UUIDv4 causes page splits and write amplification on every insert, and the 36-byte CHAR(36) key is copied into EVERY secondary index (this table has seven). MySQL has UUID() but no gen_random_uuid(), no uuid-ossp, and no UUIDv7; the ordered-binary workaround is UUID_TO_BIN(UUID(),1) into BINARY(16), which then displays as unreadable hex in Adminer and in every screenshot in the report. Also, monotonic ids make `ORDER BY id DESC` a free 'newest first' with no extra index. MySQL 8.0 persists the AUTO_INCREMENT counter across restart (5.7 did not), so ids no longer regress after a crash.
- ENUMERABILITY — the survey's objection answered head-on. Sequential ids do make /requests/47 guessable, and the old 'REQ-001' format made it trivial. The mitigation is authorization, not obscurity: every read of a help request re-checks ownership server-side (victim must be the submitter, volunteer must hold the active assignment, admin sees all), requireAuth is mounted on the entire /api/v1 router with an explicit public allowlist so a forgotten route fails closed, and demo step 8 proves it with curl — victim A gets 403 on victim B's id. A UUID would have hidden the hole rather than closed it. The honest report sentence is 'unpredictable identifiers are defence in depth, not access control'; UUIDv7 as BINARY(16) goes in Future Scope.
- NO SEQUENCES. Postgres would generate 'REQ-2026-000123' from a sequence; MySQL AUTO_INCREMENT is per-table only and cannot be read without inserting. Combined with the generated-column restriction above, the human reference is computed in the SELECT: CONCAT('REQ-', YEAR(submitted_at), '-', LPAD(id, 6, '0')). One format everywhere, replacing the three that coexist today (REQ-001, REQ-2024-B12, Case #2024-A58).
- NO `RETURNING`. Every INSERT needs a second round trip. In the claim transaction the new assignment id comes from `result.insertId` on the mysql2 OkPacket; in the create-request flow the reference string is re-selected after insert so the redirect to /requests/:id and the toast both use the canonical value.
- UPSERT SYNTAX. Postgres `INSERT ... ON CONFLICT (col) DO UPDATE` vs MySQL `INSERT ... ON DUPLICATE KEY UPDATE`, which cannot target a specific constraint (it fires on ANY unique violation) and silently consumes AUTO_INCREMENT values on every conflict. Used in exactly one place — the idempotent reference-data seed — and written with the MySQL 8.0.20+ row alias form `INSERT ... AS new ON DUPLICATE KEY UPDATE label = new.label`, because the older VALUES() function is deprecated and warns.
- ON DELETE BEHAVIOUR. MySQL has no ON DELETE SET DEFAULT. RESTRICT is the default and is used on every edge that carries history (fk_hr_submitter, fk_as_volunteer, fk_fb_author) — which turns 'users holding request history are deactivated, never deleted' from a service-layer policy into a database guarantee worth a viva paragraph. CASCADE only where the child is meaningless alone (status events, notifications, feedback under a request). SET NULL where the parent is contextual (disaster_event, assigned_by, actor). Also MySQL requires an index on every FK child column and creates one implicitly if absent — all of them are declared explicitly and named so no duplicate index is silently created, and FK names are schema-global in MySQL (not per-table as in Postgres) so every constraint is prefixed: fk_hr_, fk_as_, fk_rse_.
- CHARSET / COLLATION. Use utf8mb4, never MySQL's 'utf8' which is really utf8mb3 (3-byte) and mangles emoji and some Malayalam conjunct sequences — relevant because the domain is Kerala and a description field will eventually receive Malayalam text. Collation utf8mb4_0900_ai_ci, ROW_FORMAT=DYNAMIC. The old 'VARCHAR(191) or the index breaks' rule is a MySQL 5.7 + COMPACT artifact; on 8.0 DYNAMIC the index prefix limit is 3072 bytes (768 utf8mb4 characters). 191 is kept for email purely as a conventional width, not out of necessity.
- DATETIME vs TIMESTAMP. MySQL TIMESTAMP silently converts to and from the session time zone and dies in 2038; DATETIME stores the literal wall clock with no conversion. Every timestamp is DATETIME(3) holding UTC, with three things pinned together: the container runs `--default-time-zone=+00:00` so CURRENT_TIMESTAMP(3) and NOW() are UTC, the mysql2 pool sets `timezone: 'Z'` and `dateStrings: false`, and Angular formats to IST at the edge with DatePipe. Without the container flag the seed's DATE_SUB(NOW(), INTERVAL n DAY) would be IST-relative and every 'Resolved Today' boundary would be off by 5h30m.
- DATE ARITHMETIC AND AGGREGATION DIALECT. No `INTERVAL '7 days'` literal — use DATE_SUB(NOW(), INTERVAL 7 DAY). No date_trunc() — use DATE(submitted_at) for the 7-day trend and DATE_FORMAT() elsewhere. No `FILTER (WHERE ...)` on aggregates — the per-status counts in the list envelope are SUM(CASE WHEN status='X' THEN 1 ELSE 0 END), which is actually an advantage here because all six counts plus the total come back in ONE round trip.
- NO BOOLEAN TYPE. TINYINT(1) is the alias; mysql2 returns 0 and 1, not true and false, so every repository mapping row -> DTO must coerce (`Boolean(row.contact_permission)`) or strictTemplates will surface `0` where an *ngIf expects a boolean. Two columns affected: request_types.is_active, feedback.contact_permission.
- NO jsonb, NO ARRAYS, NO GIN. MySQL has a JSON type but no jsonb and no inverted index; indexing a JSON path requires a functional index over a hidden virtual column. Sidestepped entirely: the notification 'payload' the Postgres model carried is replaced by scalar title/body/help_request_id columns, and nothing else in the schema needs JSON. Zero JSON columns in the final design.
- CHECK CONSTRAINTS EXIST BUT ONLY FROM 8.0.16 (they parse and are ignored in 8.0.15 and earlier — a silent data-integrity failure). The compose file pins mysql:8.0 which is well past that, and the week-1 verification script asserts a CHECK actually rejects. MySQL CHECK cannot reference other tables or use subqueries, so the 'feedback only on a COMPLETED request you own' rule stays in the service layer; violations raise errno 3819 ER_CHECK_CONSTRAINT_VIOLATED, mapped to 422.
- TRANSACTION ISOLATION. MySQL defaults to REPEATABLE READ; Postgres defaults to READ COMMITTED. The consequence for the claim path: a plain SELECT inside the transaction reads a consistent snapshot taken at the first read and can therefore return a request as SUBMITTED after another session has already committed the claim. `SELECT ... FOR UPDATE` performs a CURRENT READ of the latest committed row, which is why the claim MUST lock rather than merely re-read. Default isolation is left at REPEATABLE READ and every read-then-write path uses FOR UPDATE — that sentence is a prepared viva answer.
- LOCK WAIT AND DEADLOCK CODES. innodb_lock_wait_timeout defaults to 50 seconds; with ten parallel claims queued on one row a pathological case would hang the demo. The claim connection sets `SET SESSION innodb_lock_wait_timeout = 5` so it fails fast with errno 1205 ER_LOCK_WAIT_TIMEOUT, which is mapped to 409 rather than a 30-second spinner. Errno 1213 ER_LOCK_DEADLOCK is retried exactly once. SKIP LOCKED and NOWAIT exist (8.0.1+) but are cut — there is no worker queue to drain.
- ERROR SURFACE THE CODE BRANCHES ON. mysql2 exposes err.errno and err.code: 1062 ER_DUP_ENTRY (claim conflict and duplicate feedback and duplicate email — all three), 1452 ER_NO_REFERENCED_ROW_2 (bad FK, e.g. a request_type_id that does not exist), 3819 ER_CHECK_CONSTRAINT_VIOLATED, 1205, 1213. Because 1062 covers three different business outcomes, the handler must disambiguate by index name from err.message — and note that MySQL 8.0 formats it as "Duplicate entry '46' for key 'assignments.uq_one_active_assignment'" WITH the table prefix, where 5.7 emitted the bare index name. Match on the index-name substring, never on the full string.
- NO pg_trgm / NO trigram GIN. The admin's debounced search cannot use `ILIKE '%arun%'` with an index — a leading wildcard defeats any B-tree. Workaround: anchored `LIKE CONCAT(?, '%')` against ix_users_name (last_name, first_name) plus a separate anchored match on email, UNIONed. FULLTEXT with the ngram parser was considered and rejected: ft_min_token_size / ngram_token_size tuning is a rabbit hole, and Prisma's @@fulltext is still a preview feature. At 18 seeded users, anchored LIKE is honest and instant.
- DDL IS NOT TRANSACTIONAL IN MySQL — a failed migration leaves the schema half-applied, and there is no `BEGIN; ALTER ...; ROLLBACK;`. This is one of the reasons the project runs drop-and-recreate (`docker compose down -v && up -d`) rather than a migration tool: there is no production data, and the recreate is also the demo reset.
- PRISMA-ON-MySQL GAPS, which is why schema.prisma is documentation and db/schema.sql is truth: Prisma cannot express STORED generated columns (it would emit active_help_request_id as an ordinary writable column and prisma migrate would drop the generated expression), cannot express CHECK constraints, cannot express ON UPDATE CURRENT_TIMESTAMP (it emulates @updatedAt in the client, which raw mysql2 writes would bypass), has no MySQL spatial types (POINT would be Unsupported("point") and unreadable by the client), and has @@fulltext behind a preview flag. The file is regenerated with `prisma db pull` FROM the live container, never pushed TO it.

---

## Raw SQL supplements

-- 1. THE CENTREPIECE. Full assignments DDL with the STORED generated column and its UNIQUE index, exactly as given in atomicClaimDesign. Prisma cannot emit the GENERATED ALWAYS AS clause, so this table is authored by hand in db/schema.sql and is the one Adminer has open on screen during demo beat 1. If it is ever re-added to an existing table: ALTER TABLE assignments ADD COLUMN active_help_request_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('ASSIGNED','IN_PROGRESS','AWAITING_CONFIRMATION') THEN help_request_id ELSE NULL END) STORED, ADD UNIQUE KEY uq_one_active_assignment (active_help_request_id), ALGORITHM=COPY; -- STORED generated columns force a table rebuild; INSTANT and INPLACE are not available.

-- 2. CHECK CONSTRAINTS (MySQL 8.0.16+; silently ignored on older servers, so the week-1 verification asserts one actually rejects). Declared inline in each CREATE TABLE.\nALTER TABLE help_requests\n  ADD CONSTRAINT ck_hr_people      CHECK (people_count >= 1 AND people_count <= 500),\n  ADD CONSTRAINT ck_hr_desc        CHECK (CHAR_LENGTH(description) >= 10),\n  ADD CONSTRAINT ck_hr_lat         CHECK (lat BETWEEN -90 AND 90),\n  ADD CONSTRAINT ck_hr_lng         CHECK (lng BETWEEN -180 AND 180);\nALTER TABLE assignments\n  ADD CONSTRAINT ck_as_progress    CHECK (progress_pct <= 100),\n  ADD CONSTRAINT ck_as_hours       CHECK (hours_logged IS NULL OR (hours_logged >= 0 AND hours_logged <= 24));\nALTER TABLE feedback\n  ADD CONSTRAINT ck_fb_rating      CHECK (rating BETWEEN 1 AND 5);\nALTER TABLE shelters\n  ADD CONSTRAINT ck_sh_capacity    CHECK (capacity > 0),\n  ADD CONSTRAINT ck_sh_occupancy   CHECK (current_occupancy <= capacity);\nALTER TABLE disaster_events\n  ADD CONSTRAINT ck_de_dates       CHECK (end_date IS NULL OR end_date > start_date),\n  ADD CONSTRAINT ck_de_radius      CHECK (radius_km BETWEEN 1 AND 500);\nALTER TABLE volunteer_profiles\n  ADD CONSTRAINT ck_vp_radius      CHECK (service_radius_km BETWEEN 1 AND 100),\n  ADD CONSTRAINT ck_vp_rating      CHECK (rating_avg IS NULL OR (rating_avg >= 1 AND rating_avg <= 5));\n-- Violations surface as errno 3819 ER_CHECK_CONSTRAINT_VIOLATED and are mapped to 422 by the error middleware.

-- 3. updated_at AUTO-MAINTENANCE. Prisma's @updatedAt is client-side only and raw mysql2 writes bypass it, so the behaviour is pushed into the DDL on all seven mutable tables.\n-- pattern used in every CREATE TABLE:\n--   updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)\n-- Applies to: users, volunteer_profiles, disaster_events, shelters, help_requests, assignments. NOT applied to request_status_events, notifications or feedback, which are append-only by design.

-- 4. APPEND-ONLY ENFORCEMENT ON THE AUDIT TABLE, two ways. Privilege first (the honest answer), triggers second (the demonstrable one).\n-- 4a. GRANTs, run once in db/schema.sql as root:\nCREATE USER IF NOT EXISTS 'drms_app'@'%' IDENTIFIED BY 'drms_app';\nGRANT SELECT, INSERT, UPDATE, DELETE ON drms.* TO 'drms_app'@'%';\nREVOKE UPDATE, DELETE ON drms.request_status_events FROM 'drms_app'@'%';\nFLUSH PRIVILEGES;\n-- The API connects as drms_app, never root. Adminer connects as root so the examiner can see everything.\n-- 4b. Belt and braces, and visible in SHOW TRIGGERS during the demo:\nDELIMITER $$\nCREATE TRIGGER trg_rse_no_update BEFORE UPDATE ON request_status_events FOR EACH ROW\nBEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'request_status_events is append-only'; END$$\nCREATE TRIGGER trg_rse_no_delete BEFORE DELETE ON request_status_events FOR EACH ROW\nBEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'request_status_events is append-only'; END$$\nDELIMITER ;\n-- Note: the DELETE trigger must be dropped (or FK CASCADE avoided) if a help_request is ever hard-deleted. Nothing in the app hard-deletes, and that is deliberate.

-- 5. CONNECTION / SESSION SETUP. Half of this is mysql2 pool config, half is SQL, and both halves are required for UTC correctness.\n-- docker-compose mysql command: --default-time-zone=+00:00 --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci\n-- mysql2 pool: { timezone: 'Z', dateStrings: false, supportBigNumbers: true, bigNumberStrings: false, decimalNumbers: true, namedPlaceholders: false, connectionLimit: 10 }\n-- per-connection, via the pool's connection event:\nSET SESSION time_zone = '+00:00';\nSET SESSION sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';\n-- STRICT mode matters: without it MySQL truncates an over-length VARCHAR and inserts 0 for a bad number with only a warning, which would let invalid data past Zod-validated boundaries via any raw path.\n-- on the claim connection only: SET SESSION innodb_lock_wait_timeout = 5;

-- 6. DISTANCE. SRID 0 is longitude-first; SRID 4326 in MySQL is latitude-first and would silently relocate Kerala. Never build 4326 geometry in this project.\n-- volunteer available-requests pool, sorted by real kilometres from the volunteer's saved home point:\nSELECT hr.id,\n       CONCAT('REQ-', YEAR(hr.submitted_at), '-', LPAD(hr.id, 6, '0')) AS reference,\n       rt.code, rt.label, rt.icon_key, rt.color_key,\n       hr.urgency, hr.district, hr.location_text, hr.people_count, hr.submitted_at,\n       ROUND(ST_Distance_Sphere(POINT(hr.lng, hr.lat), POINT(?, ?)) / 1000, 1) AS distance_km\n  FROM help_requests hr\n  JOIN request_types rt ON rt.id = hr.request_type_id\n LEFT JOIN assignments a ON a.active_help_request_id = hr.id\n WHERE hr.status = 'SUBMITTED' AND a.id IS NULL\n   AND (? IS NULL OR hr.request_type_id = ?)\n ORDER BY CASE ? WHEN 'urgency'  THEN NULL END, hr.urgency DESC,\n          CASE ? WHEN 'distance' THEN NULL END, distance_km ASC,\n          hr.submitted_at DESC\n LIMIT ? OFFSET ?;\n-- ST_Distance_Sphere returns METRES. Default earth radius 6370986 m. urgency DESC works because the ENUM is declared in severity order.\n-- nearest OPEN shelter for the victim dashboard (one row):\nSELECT id, name, address_text, capacity, current_occupancy,\n       ROUND(ST_Distance_Sphere(POINT(lng, lat), POINT(?, ?)) / 1000, 1) AS distance_km\n  FROM shelters WHERE status = 'OPEN' ORDER BY distance_km ASC LIMIT 1;

-- 7. OPTIONAL, NOT REQUIRED BY ANY ENDPOINT — the spatial column and index, if the report wants to claim R-tree indexing. VERIFY BEFORE USE; it is not on the critical path and adds a rebuild.\nALTER TABLE help_requests\n  ADD COLUMN geo_point POINT SRID 0 GENERATED ALWAYS AS (POINT(lng, lat)) STORED NOT NULL,\n  ADD SPATIAL INDEX sx_hr_geo (geo_point);\n-- MySQL requires a SPATIAL index column to be NOT NULL and to carry an SRID attribute. Honest caveat for the viva: an R-tree accelerates only MBR predicates (MBRContains, ST_Within), NEVER ST_Distance_Sphere ordering, so this index does nothing for the volunteer sort. The real growth path is a bounding-box prefilter on the existing DECIMAL columns:\n--   WHERE hr.lat BETWEEN ? - (?/111.0) AND ? + (?/111.0)\n--     AND hr.lng BETWEEN ? - (?/(111.0*COS(RADIANS(?)))) AND ? + (?/(111.0*COS(RADIANS(?))))\n--     AND ST_Distance_Sphere(POINT(hr.lng, hr.lat), POINT(?, ?)) <= ? * 1000\n-- The BETWEEN clauses are an index range scan; the exact sphere distance then runs over a handful of rows.

-- 8. DERIVED DISASTER-EVENT STATUS. Never stored; the shipped mock data was self-contradictory precisely because it was.\nSELECT de.id, de.name, de.type, de.severity, de.location_text, de.start_date, de.end_date, de.helpline_number,\n       CASE WHEN de.start_date > NOW()                             THEN 'UPCOMING'\n            WHEN de.end_date IS NOT NULL AND de.end_date < NOW()   THEN 'PAST'\n            ELSE 'ACTIVE' END AS status,\n       (SELECT COUNT(*) FROM help_requests hr WHERE hr.disaster_event_id = de.id) AS request_count\n  FROM disaster_events de\n ORDER BY de.start_date DESC;

-- 9. AUTO-ATTACH ON INSERT. Run inside the create-request transaction, before the INSERT; the result is bound to disaster_event_id (NULL if nothing covers the point).\nSELECT id FROM disaster_events\n WHERE start_date <= NOW()\n   AND (end_date IS NULL OR end_date >= NOW())\n   AND ST_Distance_Sphere(POINT(center_lng, center_lat), POINT(?, ?)) <= radius_km * 1000\n ORDER BY ST_Distance_Sphere(POINT(center_lng, center_lat), POINT(?, ?)) ASC\n LIMIT 1;\n-- Demo step 17 depends on this: create 'Cyclone Ditwah 2026' centred on Ernakulam with radius 40 km, submit one more request from Priya's window, and the detail screen shows it attached to the new event.

-- 10. THE LIST ENVELOPE IN ONE ROUND TRIP. MySQL has no FILTER (WHERE ...) clause, so per-status counts are SUM(CASE ...) — which is an advantage here: all six numbers plus the total arrive together, and the victim filter pills stop lying about a 10-item in-memory array.\nSELECT COUNT(*) AS total,\n       SUM(status = 'SUBMITTED')   AS c_submitted,\n       SUM(status = 'ASSIGNED')    AS c_assigned,\n       SUM(status = 'IN_PROGRESS') AS c_in_progress,\n       SUM(status = 'COMPLETED')   AS c_completed,\n       SUM(status = 'CANCELLED')   AS c_cancelled\n  FROM help_requests WHERE submitted_by_user_id = ?;\n-- (`SUM(status='X')` exploits MySQL's boolean-to-1/0 coercion; the SUM(CASE WHEN ... END) long form is equivalent and is what goes in the report.)\n-- The page of items is a second query with the same WHERE plus the status filter, LIMIT ? OFFSET ?, using ix_hr_submitter_submitted.

-- 11. THE 7-DAY TREND — seven divs with [style.height.%], no Chart.js in a bundle already at 501.22 kB against a 500 kB budget. The LEFT JOIN against a generated day series guarantees seven rows even on a day with no requests, which a bare GROUP BY would silently drop and make the bar chart lie.\nSELECT d.day, COALESCE(COUNT(hr.id), 0) AS request_count\n  FROM (SELECT DATE(DATE_SUB(NOW(), INTERVAL n DAY)) AS day\n          FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3\n                UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) AS seq) AS d\n  LEFT JOIN help_requests hr ON DATE(hr.submitted_at) = d.day\n GROUP BY d.day ORDER BY d.day ASC;

-- 12. THE ADMIN LIST WITH ITS ACTIVE ASSIGNEE — the LEFT JOIN that replaces the rejected circular FK help_requests.active_assignment_id. It is a unique-index lookup on uq_one_active_assignment, so it is cheaper than the denormalised pointer would have been, and it cannot drift.\nSELECT hr.id,\n       CONCAT('REQ-', YEAR(hr.submitted_at), '-', LPAD(hr.id, 6, '0')) AS reference,\n       CONCAT(su.first_name, ' ', su.last_name) AS submitted_by,\n       rt.label AS request_type, hr.urgency, hr.status,\n       CONCAT(vu.first_name, ' ', vu.last_name) AS assigned_to,   -- NULL renders as 'Unassigned'\n       a.progress_pct, a.claimed_at\n  FROM help_requests hr\n  JOIN users su        ON su.id = hr.submitted_by_user_id\n  JOIN request_types rt ON rt.id = hr.request_type_id\n  LEFT JOIN assignments a ON a.active_help_request_id = hr.id\n  LEFT JOIN users vu      ON vu.id = a.volunteer_user_id\n WHERE (? IS NULL OR hr.status = ?) AND (? IS NULL OR hr.request_type_id = ?)\n   AND (? IS NULL OR hr.submitted_at >= ?) AND (? IS NULL OR hr.submitted_at < ?)\n ORDER BY hr.submitted_at DESC LIMIT ? OFFSET ?;

-- 13. THE ONE SURVIVING REPORT — Help Request Summary, type x status cross-tab, rendered on screen and streamed as CSV with Content-Disposition. 'Reports' is an explicit MCA rubric line.\nSELECT rt.label AS request_type,\n       SUM(hr.status = 'SUBMITTED')   AS submitted,\n       SUM(hr.status = 'ASSIGNED')    AS assigned,\n       SUM(hr.status = 'IN_PROGRESS') AS in_progress,\n       SUM(hr.status = 'COMPLETED')   AS completed,\n       SUM(hr.status = 'CANCELLED')   AS cancelled,\n       COUNT(*)                       AS total\n  FROM help_requests hr JOIN request_types rt ON rt.id = hr.request_type_id\n WHERE hr.submitted_at >= ? AND hr.submitted_at < ?\n GROUP BY rt.id, rt.label, rt.sort_order ORDER BY rt.sort_order;

-- 14. TABLE OPTIONS applied to all ten CREATE TABLE statements, and the create/drop preamble of db/schema.sql.\nCREATE DATABASE IF NOT EXISTS drms CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\nUSE drms;\n-- every table ends with:\n--   ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;\n-- CREATE TABLE order is FK-dependency order: users, volunteer_profiles, request_types, disaster_events, shelters, help_requests, assignments, request_status_events, feedback, notifications. No SET FOREIGN_KEY_CHECKS=0 anywhere — that is precisely what would have broken docker-entrypoint-initdb.d, and it is why the circular FK was rejected.

-- 15. ADMIN USER SEARCH — anchored LIKE, no pg_trgm equivalent in MySQL and a leading wildcard defeats every B-tree.\nSELECT id, first_name, last_name, email, role, status, created_at\n  FROM users\n WHERE (last_name LIKE CONCAT(?, '%') OR first_name LIKE CONCAT(?, '%') OR email LIKE CONCAT(?, '%'))\n   AND (? IS NULL OR role = ?)\n ORDER BY last_name, first_name LIKE 'arun%' -- uses ix_users_name\n LIMIT ? OFFSET ?;\n-- Guardrail queries that belong in the same repository, each worth a viva paragraph:\n--   last-admin check:  SELECT COUNT(*) FROM users WHERE role='ADMIN' AND status='ACTIVE' AND id <> ?;\n--   self-deactivate:   rejected in the service by comparing req.user.id to the target id.\n--   never delete:      fk_hr_submitter and fk_as_volunteer are ON DELETE RESTRICT, so the database refuses anyway.

---

## Seed data plan

FILE LAYOUT AND EXECUTION. Two files mounted read-only into /docker-entrypoint-initdb.d/ as db/01-schema.sql and db/02-seed.sql — the entrypoint runs *.sql in ALPHABETICAL order, so the numeric prefixes are load-bearing, not cosmetic. They run only when the named volume is empty, which is why the reset command is `docker compose down -v && docker compose up -d` and why it is also the migration story. Rehearse it; it is 20 seconds and it is the answer to any demo-day data accident.

THE ONE RULE THAT MATTERS MORE THAN THE CONTENT: every timestamp is relative — DATE_SUB(NOW(), INTERVAL n DAY), INTERVAL n HOUR, INTERVAL n MINUTE. Literal dates mean that on demo day 'Resolved Today' reads 0, the activity feed says 'a year ago', the 7-day trend is seven empty bars, and every screenshot in the report shows an abandoned system. Because the container runs --default-time-zone=+00:00, NOW() is UTC and lines up with what the API writes.

Every INSERT names its columns explicitly. assignments in particular must never be inserted with a bare VALUES list or a SELECT * — active_help_request_id is a generated column and MySQL raises error 3105.

--- REFERENCE DATA ---
request_types, 5 rows: (MEDICAL, 'Medical Assistance', heartbeat, red, 1), (FOOD_WATER, 'Food & Water', utensils, green, 2), (SHELTER, 'Shelter / Housing', home, blue, 3), (RESCUE, 'Rescue / Evacuation', truck, purple, 4), (OTHER, 'Other', question-circle, gray, 5). These five finally make all four out-of-sync dropdowns agree, and add the 'Rescue / Evacuation' option the admin filter is missing today.

Kerala district centroids are NOT seeded as a table — the entity list is frozen at ten and the demo says 'ten tables' twice. They live in backend/src/reference/kerala-districts.ts as 14 { code, label, lat, lng } entries (Thiruvananthapuram 8.5241/76.9366, Kollam 8.8932/76.6141, Pathanamthitta 9.2648/76.7870, Alappuzha 9.4981/76.3388, Kottayam 9.5916/76.5222, Idukki 9.8497/76.9784, Ernakulam 9.9816/76.2999, Thrissur 10.5276/76.2144, Palakkad 10.7867/76.6548, Malappuram 11.0510/76.0711, Kozhikode 11.2588/75.7804, Wayanad 11.6854/76.1320, Kannur 11.8745/75.3704, Kasaragod 12.4996/74.9869), imported by the service layer and mirrored as the Angular dropdown options. This array is what replaces the external geocoding provider.

--- USERS: 18 TOTAL (1 + 7 + 10), ALL WITH THE SAME bcryptjs COST-12 HASH ---
One precomputed hash literal for the password `Passw0rd!123`, reused across all 18 rows with a comment saying so. Generating 18 distinct hashes at cost 12 inside a SQL file is impossible and at seed time is pointless. Write the demo credentials on a sticky note.

ADMIN (1): Anitha Menon, admin@drms.local, ADMIN, ACTIVE, home_district ERNAKULAM, created 400 days ago, terms_accepted_at set.

VOLUNTEERS (7, each with a volunteer_profiles row):
  - Arun Kumar, arun@drms.local, APPROVED, home point 10.0930/76.3480 (Aluva), rating_avg 4.7 / 11 ratings, completed_count 14, hours_logged 46.50 — the demo's winning claimant.
  - Meera Nair, meera@drms.local, APPROVED, 10.0159/76.3419 (Kakkanad) — the demo's losing claimant, deliberately seeded near Arun so both see the same card at a similar distance.
  - Sneha Pillai, APPROVED, Ernakulam, rating 4.9 / 8, completed 9, hours 31.25.
  - Rahul Varghese, APPROVED, Wayanad 11.6854/76.1320, completed 7, hours 22.00.
  - Fathima Beevi, APPROVED, Idukki, completed 5, hours 18.75.
  - Deepak Menon, APPROVED, Thrissur, completed 4, hours 12.50.
  - Vishnu Prasad, vishnu@drms.local, approval_status PENDING, Ernakulam, all aggregates zero — the one spare for demo step 9's Approve beat. Every volunteer on the demo click-path is APPROVED so an approval step can never stall the demo, which is exactly the defensive-seeding ruling.

VICTIMS (10), all across the three demo districts so the district filter has content:
  ERNAKULAM (5): Priya Raghavan (priya@drms.local, home point 10.0900/76.3400 so the nearest OPEN shelter reads ~2.4 km and her SOS lands on a real point), Joseph Thomas, Lakshmi Devi, Suresh Babu, Vinod Chandran.
  WAYANAD (3): Bindu Rajan, Anu Jacob, Sreeja Mohan.
  IDUKKI (2): Manoj Kurian, Reshma Sunil.
  Every victim has a +91 phone and terms_accepted_at; created_at staggered from 300 days ago to 3 days ago so the Total Users KPI and the registrations-over-time story are plausible.

--- DISASTER EVENTS: 4, reusing the exact fixtures already in the mock data, with dates chosen so all three DERIVED statuses appear on one screen ---
  1. Kerala Floods 2025 — FLOOD, SEVERE, centre Thrissur 10.5276/76.2144, radius_km 150 (covers Ernakulam ~61 km, Idukki ~110 km, Wayanad ~128 km, so all seeded victim districts auto-attach to it), helpline 1077, start NOW-20d, end NULL --> derives ACTIVE. This is the event on Priya's dashboard card.
  2. Cyclone Remal Response — CYCLONE, MODERATE, district NULL, location_text 'West Bengal, India', centre 22.5726/88.3639, radius 80, start NOW-125d, end NOW-108d --> derives PAST. district is nullable precisely so the real out-of-state fixture survives instead of being falsified into a Kerala district.
  3. Uttarakhand Landslide Relief — LANDSLIDE, SEVERE, district NULL, 'Uttarakhand, India', centre 30.0668/79.0193, radius 60, start NOW-210d, end NOW-185d --> PAST.
  4. Pre-Monsoon Preparedness — OTHER, LOW, THRISSUR, centre 10.5276/76.2144, radius 40, start NOW+16d, end NOW+46d --> UPCOMING. This is the row whose stored status contradicted its own dates in the original mock data; seeding it this way is the setup for the viva line about derived vs stored status.

--- SHELTERS: 8, read-only, real coordinates so the kilometre figures are genuinely computed ---
Govt. HSS Aluva (Ernakulam, 10.1081/76.3510, 300/180, OPEN, linked to event 1) — the one the demo names. Rajagiri Community Hall (Ernakulam, Kalamassery, 250/250, FULL — so the 'nearest OPEN' query visibly skips a closer full shelter, which is the feature, not a bug). Ernakulam Town Hall (Ernakulam, 400/95, OPEN). St. Joseph's HSS Kalpetta (Wayanad, 200/140, OPEN, event 1). Govt. Tribal School Mananthavady (Wayanad, 150/30, OPEN). Idukki Govt. College Camp (Idukki, 180/60, OPEN, event 1). Painavu Panchayat Hall (Idukki, 120/120, FULL). Thrissur Corporation Relief Centre (Thrissur, 350/0, CLOSED — so all three ShelterStatus values are visible in the admin table).

--- HELP REQUESTS: ~45 SPREAD OVER THE LAST 14 DAYS, ALL FIVE STATUSES ---
Status mix: 9 SUBMITTED (the volunteer pool has real content on first paint), 7 ASSIGNED, 6 IN_PROGRESS, 18 COMPLETED (feeds Completed This Month, Resolved Today, the ratings and the report), 5 CANCELLED (the 'Cancelled' pill becomes reachable in seed data as well as by the live Cancel button). Spread across all five request_types and all four urgencies, with 6 CRITICAL rescue/medical rows so the urgency sort has something dramatic at the top. submitted_at scattered across INTERVAL 0..13 DAY with 4 rows inside the last 6 hours so 'posted 3h ago' is literally true, and 3 rows completed inside today so 'Resolved Today' is non-zero before anyone touches the app. 45 rows across pageSize 10 means 5 pages, which is what makes the pagination controls and the per-status counts look like a real system instead of 'Page 1 of 1'.
  Location realism: district plus a Kerala landmark in location_text ('near Aluva Metro Station', 'Chengamanad panchayat ward 7', 'below Kuttiyadi bridge', 'Vythiri tea estate quarters'), lat/lng jittered around the district centroid within a few km with location_source 'FIELD_REPORTED' — honest, because these represent field-collected reports, while anything the demo creates live is stamped HOME_POINT or DISTRICT_CENTROID. That jitter is also what makes the distance column on available-requests show a spread of values rather than the same number 9 times.
  disaster_event_id: every Kerala row attached to event 1, matching what the auto-attach query would compute.

--- REQUEST STATUS EVENTS: ~125 ROWS, A COMPLETE TRAIL PER REQUEST ---
SUBMITTED rows get 1 event; ASSIGNED 2; IN_PROGRESS 3; COMPLETED 4; CANCELLED 2. Each event's occurred_at sits between the request's submitted_at and NOW() in correct order with plausible gaps (30m to 2 days), actor_user_id and actor_role set to whoever really would have done it — victim for SUBMITTED and CANCELLED, volunteer for ASSIGNED/IN_PROGRESS/COMPLETED, admin on three rows so the activity feed shows all three roles. This single table is what makes the admin Recent System Activity feed full of real names and real relative times at first paint, and what gives every /requests/:id a timeline before anyone clicks anything.

--- ASSIGNMENTS: ~31 ROWS ---
One per ASSIGNED (7), IN_PROGRESS (6) and COMPLETED (18) request, plus 2 RELEASED rows on requests that were later re-claimed — which proves in seed data that a request can carry multiple historical assignments while the unique index still holds, and is worth pointing at in Adminer. progress_pct 0 for ASSIGNED, 25-75 for IN_PROGRESS, 100 for COMPLETED. hours_logged 0.75-6.50 on COMPLETED rows only, summing to each volunteer's seeded hours_logged aggregate so the KPI and the detail rows agree. assigned_by_user_id set to the admin on 4 rows so the 'admin-assigned vs self-claimed' distinction is visible before the demo creates one. claimed_at always after the request's submitted_at.

--- FEEDBACK: 15 ROWS ON 18 COMPLETED REQUESTS ---
Three completed requests are deliberately left un-rated so that (a) the victim's 'Give Feedback' button has somewhere to go besides the one the demo creates, and (b) the UNIQUE index is not the only thing standing between the demo and a 409. Ratings skewed high but not uniform (nine 5s, four 4s, one 3, one 2) so rating_avg values like 4.7 are arithmetically defensible if an examiner checks. Comments in plain Indian English referencing the fixtures ('Volunteer reached Aluva within two hours with drinking water'). contact_permission true on 4 rows. volunteer_user_id denormalised from the assignment on every row so AVG(rating) GROUP BY volunteer is one query.

--- NOTIFICATIONS: 40 ROWS ---
Distributed across all 18 users, weighted toward the four demo accounts so every bell has content the instant you log in. 12 unread (read_at NULL) so the header badge shows a real number rather than a permanently-lit dot; the rest read. created_at from 10 days ago to 20 minutes ago, so the newest seeded item is recent but the live demo-generated 'A volunteer has been assigned to your request' still lands on top. Every REQUEST_* row carries help_request_id so the dropdown deep-links to /requests/:id and the link actually resolves — the thing href="#" never did. Two VOLUNTEER_APPROVED rows with help_request_id NULL, to exercise the nullable FK.

--- SELF-CONSISTENCY INVARIANTS THE SEED MUST SATISFY (worth a 20-line check script, run once) ---
Every COMPLETED request has completed_at set, exactly one COMPLETED assignment, and 4 status events ending in COMPLETED. Every request with status ASSIGNED/IN_PROGRESS has exactly one row in assignments with a non-NULL active_help_request_id, and no COMPLETED or CANCELLED request has one. Each volunteer's hours_logged equals SUM(assignments.hours_logged), completed_count equals COUNT of their COMPLETED assignments, and rating_avg equals AVG of their feedback — because an examiner who adds up the numbers on screen and finds they disagree has found a more damaging bug than any missing feature.

---

## ER diagram notes

HOW TO PRODUCE IT (2 minutes, not 2 hours). MySQL Workbench > Database > Reverse Engineer > connect to 127.0.0.1:3306 as root > select the `drms` schema > Execute. Workbench builds the EER diagram with all ten tables and every FK already drawn, read from the LIVE database — so the diagram cannot drift from the schema, which is the single biggest reason hand-drawn ER diagrams lose marks. Then: Model > Object Notation > Workbench (Simplified) to drop datatype clutter, and Model > Relationship Notation > Crow's Foot (IE). File > Page Setup > A4 Landscape. Export via File > Export > Export as Single Page PDF (vector, so it stays sharp when the report is printed).

WHY CROW'S FOOT AND NOT CHEN. Ten tables averaging eleven attributes is ~110 attribute ellipses in Chen notation — physically illegible on A4 and a guaranteed two-page spill. Crow's foot puts attributes inside the entity box and reserves the page's whitespace for the relationships, which is what the examiner actually reads. Say this out loud if asked; "I chose the notation that fits the cardinality of my model" is a better answer than "that's what the tool produced".

THE LAYOUT — THREE VERTICAL BANDS, READ LEFT TO RIGHT AS THE WORKFLOW.
  LEFT BAND (identity): users, with volunteer_profiles directly beneath it (1:0..1, drawn short and vertical so the identifying relationship reads as an extension of users, which is what it is).
  CENTRE BAND (the golden thread, and the widest column): help_requests in the middle, assignments to its right, feedback to the right of assignments. This is submit -> claim -> rate, left to right, and it is the same order as the demo script and the Level-1 DFD.
  RIGHT BAND (evidence and output): request_status_events above notifications, both hanging off help_requests.
  TOP/FAR-LEFT (context and lookups): request_types feeding help_requests from the left, disaster_events above help_requests, shelters attached below disaster_events.

THE ONE REAL LEGIBILITY PROBLEM, AND THE FIX. users is the endpoint of EIGHT foreign keys (submitter, volunteer, assigner, actor, feedback author, feedback volunteer, notification recipient, event creator, profile approver). Drawn naively that is a spider and the page is unreadable. Do this instead: draw users ONCE in the left band and route every edge out of its right-hand side, then split them visually into two classes.
  SOLID lines, labelled with the verb, for the five structural relationships the workflow depends on: users --submits--> help_requests, users --claims--> assignments, users --rates--> feedback, users --receives--> notifications, users --extends--> volunteer_profiles.
  DASHED thin lines, unlabelled on the canvas, for the four attribution edges: assignments.assigned_by_user_id, request_status_events.actor_user_id, disaster_events.created_by_user_id, volunteer_profiles.approved_by_user_id, plus feedback.volunteer_user_id (denormalised). Put these five in a small boxed LEGEND in the bottom-left corner reading "dashed = attribution FK to users (who performed the action); solid = structural participation". Workbench will not do this for you — after reverse-engineering, select those five connections and set Line Style to dashed in the properties panel, and drag them so they enter users' box at different vertical offsets. Budget 20 minutes for this cleanup; it is the difference between a diagram and a hairball.

ANNOTATE THE ONE THING THAT MAKES THE DIAGRAM ARGUE FOR YOU. Add a Workbench text note with a leader line pointing at assignments.active_help_request_id reading: "STORED generated column = help_request_id while the assignment is live, NULL once it is not. UNIQUE. MySQL treats NULLs as distinct --> at most one active assignment per request, enforced by the database." One sentence, and it pre-empts the examiner's best question. Keep that column VISIBLE in the box; do not hide it with the other non-key columns.

WHAT TO SHOW AND WHAT TO SUPPRESS IN EACH BOX. Show: the PK (key icon), every FK (diamond icon), every ENUM column, and any column a constraint depends on (active_help_request_id, status, help_request_id, rating, people_count). Suppress in the one-page version: created_at, updated_at, and the audit-ish scalars. Put the full column list in the report's Table Structures chapter, which is db/schema.sql transcribed verbatim — the ER diagram's job is relationships, the DDL listing's job is completeness, and trying to make one artifact do both is how the page becomes unreadable.

CARDINALITIES TO VERIFY BY EYE BEFORE EXPORT (all fifteen; Workbench infers them from NOT NULL and UNIQUE, and gets them right if the DDL is right):
  users 1 --- 0..1 volunteer_profiles        (PK is the FK)
  users 1 --- 0..N help_requests             (submitter, RESTRICT)
  request_types 1 --- 0..N help_requests
  disaster_events 0..1 --- 0..N help_requests
  disaster_events 0..1 --- 0..N shelters
  help_requests 1 --- 0..N assignments       (at most one ACTIVE — annotate, the notation cannot express it)
  users 1 --- 0..N assignments               (volunteer)
  users 0..1 --- 0..N assignments            (assigned_by)
  help_requests 1 --- 1..N request_status_events
  users 0..1 --- 0..N request_status_events  (actor)
  help_requests 1 --- 0..1 feedback          (UNIQUE fk — draw the 1:1 bar, it is a selling point)
  assignments 0..1 --- 0..1 feedback
  users 1 --- 0..N feedback                  (author) and 0..1 --- 0..N (volunteer rated)
  users 1 --- 0..N notifications
  help_requests 0..1 --- 0..N notifications
  users 1 --- 0..N disaster_events           (creator)

THE THREE SENTENCES OF CAPTION UNDER THE FIGURE, which is where the marks actually are: (1) "assignments is an associative entity resolving the many-to-many between help_requests and volunteers, carrying its own attributes — claimed_at, status, progress_pct, hours_logged, completion_notes." (2) "disaster_events has no status attribute because status is a pure function of start_date, end_date and now(); it is derived in SQL, never stored." (3) "The model is in third normal form: presentation attributes (icon, colour) were moved into request_types, the volunteer display name was promoted into the assignments entity, and status history was moved into an append-only table rather than a single updated_at column."

TIE IT TO THE DFDs WHILE YOU ARE HERE. Name the six Express routers exactly after the six Level-1 processes — auth/users, requests intake, claim/assignments, tracking/notifications, feedback, admin/reports — and label the ten data stores D1..D10 in the same order as the ten tables on this diagram. Then Level 0 and Level 1 fall straight out of files you have already written, and the ER diagram and the DFDs cross-reference each other by construction. Decompose Level 2 for intake and dispatch only; a Level 2 of "Feedback" is padding an examiner will notice.
