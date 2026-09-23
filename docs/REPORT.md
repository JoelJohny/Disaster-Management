# Report and Diagrams Plan

---

## ER diagram

═══════════════════════════════════════════════════════════════
ER DIAGRAM — DRMS (10 entities, crow's-foot, one A4 landscape page)
═══════════════════════════════════════════════════════════════

--- HOW TO PRODUCE IT (2 passes, ~90 min total, week 1 day 2) ---

PASS 1 — machine-generated truth (10 minutes, do this the hour db/schema.sql first
runs clean in the container):
  MySQL Workbench 8.0 (free) -> Database -> Reverse Engineer -> connect to
  127.0.0.1:3306 / root / root / schema `drms` -> select all 10 tables -> Execute.
  Workbench draws an EER with every FK as a real relationship line. Immediately do:
    Model -> Diagram Properties -> size A4 Landscape (or A3 if your printer allows)
    right-click each table -> "Collapse" columns you don't want shown
    File -> Export -> Export as PNG (300 dpi) AND Export as SVG.
  Save as docs/diagrams/er-workbench-raw.png. This is your PROOF the diagram matches
  the database — keep it, you may show it in the viva. But do NOT submit it: Workbench
  uses IE-style notation, shows every column, and prints illegibly.

PASS 2 — the graded diagram (60-80 minutes) in diagrams.net (draw.io) Desktop,
Shape Library -> "Entity Relation" (has proper crow's-foot terminators).
Redraw the 10 boxes by hand using the layout below, reading the FKs off the Workbench
PNG so you cannot get a relationship wrong.

--- NOTATION RULES (state these in a legend box, bottom-left of the page) ---
  * Crow's-foot (Barker/IE), NOT Chen. 10 tables x ~9 attributes = ~90 ellipses in
    Chen notation; it is unreadable on A4 and it takes a day. Crow's-foot is what
    every MySQL/DB text uses and no examiner objects.
  * Box = entity. Attributes listed inside. PK marked "PK" in the left gutter and
    underlined. FK marked "FK". Generated column marked "GEN".
  * Line ends: "|" = exactly one, "0<" (circle + crow) = zero-or-many,
    "|<" (bar + crow) = one-or-many, "0|" (circle + bar) = zero-or-one.
  * PARTICIPATION: the circle nearest the entity means OPTIONAL (partial)
    participation, the bar means MANDATORY (total). Say this in the legend — examiners
    ask specifically about participation and most students draw crow's feet without it.
  * Every relationship line carries a VERB PHRASE read parent-to-child
    (e.g. users ——submits——> help_requests).

--- ATTRIBUTE DISPLAY RULE (this is what keeps it on one page) ---
Show in each box: the PK, EVERY FK, and at most 6 business attributes (the ones a
reader needs to understand the entity). Do NOT show created_at / updated_at on the
diagram — add one italic footnote under the legend:
  "All entities additionally carry created_at and updated_at DATETIME(3) audit
   columns; the complete column list, data types, constraints and indexes for every
   table appear in Section 4.6 Table Structures."
That footnote is why the diagram is legible and it costs you nothing, because
Section 4.6 is db/schema.sql transcribed verbatim.

--- CANVAS LAYOUT (4 rows x 3 columns, 15 mm gutters — the gutters are load-bearing,
they are where the long users-edges get routed) ---

  COL A (left)          COL B (centre)          COL C (right)
  ──────────────────────────────────────────────────────────────
R1  request_types        users  <-- the hub      volunteer_profiles
R2  disaster_events      help_requests           request_status_events
R3  shelters             assignments             notifications
R4  (empty)              feedback                (legend box here)

Routing rule for the four long edges out of `users` down to assignments and feedback:
run them orthogonally down the LEFT gutter (between COL A and COL B) and the RIGHT
gutter, never straight through the help_requests box. Label each with its role word
(volunteer / assigned_by / author / rated) so the two lines into assignments and the
two into feedback are individually readable.

--- ENTITY BOXES, EXACTLY AS DRAWN ---

[R1-A] request_types
  PK  id                 SMALLINT UNSIGNED
      code               VARCHAR(20)  UNIQUE
      label              VARCHAR(60)
      icon_key           VARCHAR(40)
      color_key          VARCHAR(20)
      sort_order         TINYINT UNSIGNED
      is_active          TINYINT(1)

[R1-B] users                                  <-- draw this box wider; it is the hub
  PK  id                 BIGINT UNSIGNED
      email              VARCHAR(191) UNIQUE
      password_hash      CHAR(60)
      first_name         VARCHAR(60)
      last_name          VARCHAR(60)
      phone              VARCHAR(20) UNIQUE NULL
      role               ENUM(ADMIN,VOLUNTEER,VICTIM)
      status             ENUM(ACTIVE,INACTIVE)
      home_district      ENUM(14 Kerala districts) NULL
      home_lat/home_lng  DECIMAL(9,6) NULL

[R1-C] volunteer_profiles
  PK,FK user_id          BIGINT UNSIGNED        <-- mark BOTH; this is the 1:1 tell
      approval_status    ENUM(PENDING,APPROVED,REJECTED)
  FK  approved_by_user_id BIGINT UNSIGNED NULL
      service_radius_km  SMALLINT UNSIGNED
      rating_avg         DECIMAL(3,2) NULL
      completed_count    INT UNSIGNED
      hours_logged       DECIMAL(7,2)

[R2-A] disaster_events
  PK  id                 BIGINT UNSIGNED
      name               VARCHAR(120)
      type               ENUM(FLOOD,CYCLONE,LANDSLIDE,...)
      severity           ENUM(LOW,MODERATE,SEVERE,CATASTROPHIC)
      center_lat/lng     DECIMAL(9,6)
      radius_km          SMALLINT UNSIGNED
      helpline_number    VARCHAR(20) NULL
      start_date         DATETIME(3)
      end_date           DATETIME(3) NULL
  FK  created_by_user_id BIGINT UNSIGNED
      -- (derived) status = f(start_date, end_date, NOW())   <-- write this line in
         italics inside the box with the note "derived, not stored"

[R2-B] help_requests                          <-- draw this box LARGEST; it is the core
  PK  id                 BIGINT UNSIGNED
  FK  submitted_by_user_id BIGINT UNSIGNED
  FK  request_type_id    SMALLINT UNSIGNED
  FK  disaster_event_id  BIGINT UNSIGNED NULL
      urgency            ENUM(LOW,MEDIUM,HIGH,CRITICAL)
      status             ENUM(SUBMITTED,ASSIGNED,IN_PROGRESS,COMPLETED,CANCELLED)
      district           ENUM(14 Kerala districts)
      lat / lng          DECIMAL(9,6)
      people_count       SMALLINT UNSIGNED
      submitted_at       DATETIME(3)
      -- (derived) reference = CONCAT('REQ-',YEAR(submitted_at),'-',LPAD(id,6,'0'))

[R2-C] request_status_events
  PK  id                 BIGINT UNSIGNED
  FK  help_request_id    BIGINT UNSIGNED
      from_status        ENUM(5) NULL
      to_status          ENUM(5)
  FK  actor_user_id      BIGINT UNSIGNED NULL
      actor_role         ENUM(ADMIN,VOLUNTEER,VICTIM) NULL
      note               VARCHAR(255) NULL
      occurred_at        DATETIME(3)

[R3-A] shelters
  PK  id                 BIGINT UNSIGNED
      name               VARCHAR(120)
      district           ENUM(14 Kerala districts)
      lat / lng          DECIMAL(9,6)
      capacity           SMALLINT UNSIGNED
      current_occupancy  SMALLINT UNSIGNED
      status             ENUM(OPEN,FULL,CLOSED)
  FK  disaster_event_id  BIGINT UNSIGNED NULL

[R3-B] assignments        <-- draw with a DOUBLE BORDER (associative entity convention)
  PK  id                 BIGINT UNSIGNED
  FK  help_request_id    BIGINT UNSIGNED
  FK  volunteer_user_id  BIGINT UNSIGNED
  FK  assigned_by_user_id BIGINT UNSIGNED NULL
      status             ENUM(ASSIGNED,IN_PROGRESS,AWAITING_CONFIRMATION,COMPLETED,RELEASED)
  GEN active_help_request_id  BIGINT UNSIGNED  UNIQUE   <-- highlight this row in a
      progress_pct       TINYINT UNSIGNED                   different fill colour
      hours_logged       DECIMAL(5,2) NULL
      claimed_at         DATETIME(3)
      completed_at       DATETIME(3) NULL
  Add a callout box with a leader line to this table reading:
    "UNIQUE(active_help_request_id): STORED generated column, NULL unless the
     assignment is live. Enforces at most ONE active assignment per help request.
     (MySQL has no partial indexes; NULLs in a UNIQUE index are distinct.)"
  This callout is the single highest-value annotation on the whole diagram — it is
  the thing the examiner will point at.

[R3-C] notifications
  PK  id                 BIGINT UNSIGNED
  FK  recipient_user_id  BIGINT UNSIGNED
      type               ENUM(REQUEST_SUBMITTED,REQUEST_ASSIGNED,...)
      title              VARCHAR(120)
      body               VARCHAR(255)
  FK  help_request_id    BIGINT UNSIGNED NULL
      read_at            DATETIME(3) NULL
      created_at         DATETIME(3)

[R4-B] feedback
  PK  id                 BIGINT UNSIGNED
  FK  help_request_id    BIGINT UNSIGNED  UNIQUE
  FK  assignment_id      BIGINT UNSIGNED NULL UNIQUE
  FK  submitted_by_user_id BIGINT UNSIGNED
  FK  volunteer_user_id  BIGINT UNSIGNED NULL
      rating             TINYINT UNSIGNED  (1..5)
      comments           TEXT NULL
      contact_permission TINYINT(1)

--- THE 16 RELATIONSHIP LINES (draw exactly these, no more, no fewer) ---
Read the cardinality column as  PARENT : CHILD.

 #  Parent            Verb phrase              Child                  Card.  Participation
 1  users             has volunteer profile    volunteer_profiles     1 : 0..1
       users OPTIONAL (only VOLUNTEER-role rows have one) | child TOTAL. PK=FK, so
       draw it as an IDENTIFYING relationship (solid line) — the only one on the page.
 2  users             approves                 volunteer_profiles     1 : 0..N
       (approved_by_user_id) both OPTIONAL. Draw as a dashed/secondary line; label
       "approves". Two lines between the same pair of boxes is correct and expected.
 3  users             submits                  help_requests          1 : 0..N
       users OPTIONAL | help_requests TOTAL (mandatory: NOT NULL, ON DELETE RESTRICT).
 4  request_types     categorises              help_requests          1 : 0..N
       request_types OPTIONAL | child TOTAL.
 5  disaster_events   contextualises           help_requests          1 : 0..N
       BOTH OPTIONAL (disaster_event_id is NULL-able; a request outside every event
       radius attaches to none). Draw the child end 0<, the parent end 0|.
 6  users (ADMIN)     declares                 disaster_events        1 : 0..N
       users OPTIONAL | disaster_events TOTAL.
 7  disaster_events   shelters for             shelters               1 : 0..N
       BOTH OPTIONAL (nullable FK, ON DELETE SET NULL).
 8  help_requests     has status history       request_status_events  1 : 1..N
       ** ONE-OR-MANY, not zero-or-many ** — every request is created with its
       SUBMITTED row inside the same transaction. Child TOTAL. This is the one place
       you get to show a "1..N" crow's foot with a BAR, and it is worth a viva line.
 9  users             acts on                  request_status_events  1 : 0..N
       BOTH OPTIONAL (actor_user_id NULL for system-generated rows).
10  help_requests     is claimed via           assignments            1 : 0..N
       parent OPTIONAL (a SUBMITTED request has none) | child TOTAL.
       ** Annotate this line: "0..N historical, at most 1 ACTIVE (uq_one_active_
       assignment)" — this is how you draw a constraint crow's-foot cannot express. **
11  users (VOLUNTEER) is assigned via          assignments            1 : 0..N
       parent OPTIONAL | child TOTAL.
12  users (ADMIN)     assigns                  assignments            1 : 0..N
       BOTH OPTIONAL (NULL when the volunteer self-claims from the pool).
13  help_requests     is rated by              feedback               1 : 0..1
       ** 1:1 OPTIONAL — enforced by uq_feedback_help_request. Draw 0| at the child
       end, not a crow's foot. Most students get this wrong; getting it right is the
       "one feedback per request is a UNIQUE index, not an if-statement" answer. **
14  assignments       is rated by              feedback               1 : 0..1
       BOTH OPTIONAL (uq_feedback_assignment).
15  users             receives                 notifications          1 : 0..N
       parent OPTIONAL | child TOTAL, ON DELETE CASCADE.
16  help_requests     triggers                 notifications          1 : 0..N
       BOTH OPTIONAL (help_request_id NULL for VOLUNTEER_APPROVED).
Plus two more feedback FKs that you SHOULD draw but may collapse into one labelled
line each to avoid a hairball:
17  users             writes                   feedback   1 : 0..N  (author, child TOTAL)
18  users (VOLUNTEER) is rated in              feedback   1 : 0..N  (both OPTIONAL)

--- THE M:N SENTENCE TO PUT IN THE CAPTION (the examiner is looking for it) ---
"Fig 4.2 — ER diagram. The many-to-many association between HELP_REQUESTS and
VOLUNTEERS (a volunteer serves many requests over time; a request may pass through
several volunteers if one is released) is resolved by the associative entity
ASSIGNMENTS, which carries its own descriptive attributes claimed_at, status,
progress_pct, hours_logged and completion_notes. The database additionally guarantees,
through a UNIQUE index on a STORED generated column, that no request has more than one
ACTIVE assignment at any instant."

--- PASTEABLE: dbdiagram.io DBML (free, browser, exports PNG/PDF in one click) ---
Use this if draw.io feels slow. Paste into https://dbdiagram.io/d — it auto-draws
crow's-foot and you only drag the boxes into the 4x3 grid above.

Table users {
  id bigint [pk, increment]
  email varchar(191) [unique, not null]
  password_hash char(60) [not null]
  first_name varchar(60) [not null]
  last_name varchar(60) [not null]
  phone varchar(20) [unique, null]
  role varchar [not null, note: 'ADMIN|VOLUNTEER|VICTIM']
  status varchar [not null, note: 'ACTIVE|INACTIVE']
  home_district varchar [null, note: '14 Kerala districts']
  home_lat decimal(9,6) [null]
  home_lng decimal(9,6) [null]
}
Table volunteer_profiles {
  user_id bigint [pk]
  approval_status varchar [not null, note: 'PENDING|APPROVED|REJECTED']
  approved_by_user_id bigint [null]
  service_radius_km smallint [not null]
  rating_avg decimal(3,2) [null]
  completed_count int [not null]
  hours_logged decimal(7,2) [not null]
}
Table request_types {
  id smallint [pk, increment]
  code varchar(20) [unique, not null]
  label varchar(60) [not null]
  icon_key varchar(40) [not null]
  color_key varchar(20) [not null]
  sort_order tinyint [not null]
  is_active tinyint [not null]
}
Table disaster_events {
  id bigint [pk, increment]
  name varchar(120) [not null]
  type varchar [not null]
  severity varchar [not null]
  district varchar [null]
  center_lat decimal(9,6) [not null]
  center_lng decimal(9,6) [not null]
  radius_km smallint [not null]
  helpline_number varchar(20) [null]
  start_date datetime [not null]
  end_date datetime [null]
  created_by_user_id bigint [not null]
}
Table shelters {
  id bigint [pk, increment]
  name varchar(120) [not null]
  district varchar [not null]
  lat decimal(9,6) [not null]
  lng decimal(9,6) [not null]
  capacity smallint [not null]
  current_occupancy smallint [not null]
  status varchar [not null, note: 'OPEN|FULL|CLOSED']
  disaster_event_id bigint [null]
}
Table help_requests {
  id bigint [pk, increment]
  submitted_by_user_id bigint [not null]
  request_type_id smallint [not null]
  disaster_event_id bigint [null]
  urgency varchar [not null, note: 'LOW|MEDIUM|HIGH|CRITICAL']
  status varchar [not null, note: 'SUBMITTED|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED']
  district varchar [not null]
  location_text varchar(200) [not null]
  lat decimal(9,6) [not null]
  lng decimal(9,6) [not null]
  people_count smallint [not null]
  submitted_at datetime [not null]
  completed_at datetime [null]
}
Table request_status_events {
  id bigint [pk, increment]
  help_request_id bigint [not null]
  from_status varchar [null]
  to_status varchar [not null]
  actor_user_id bigint [null]
  actor_role varchar [null]
  note varchar(255) [null]
  occurred_at datetime [not null]
}
Table assignments {
  id bigint [pk, increment]
  help_request_id bigint [not null]
  volunteer_user_id bigint [not null]
  assigned_by_user_id bigint [null]
  status varchar [not null, note: 'ASSIGNED|IN_PROGRESS|AWAITING_CONFIRMATION|COMPLETED|RELEASED']
  active_help_request_id bigint [unique, null, note: 'STORED GENERATED: help_request_id when status is active, else NULL. Enforces one active assignment per request.']
  progress_pct tinyint [not null]
  hours_logged decimal(5,2) [null]
  claimed_at datetime [not null]
  completed_at datetime [null]
}
Table feedback {
  id bigint [pk, increment]
  help_request_id bigint [unique, not null]
  assignment_id bigint [unique, null]
  submitted_by_user_id bigint [not null]
  volunteer_user_id bigint [null]
  rating tinyint [not null]
  comments text [null]
  contact_permission tinyint [not null]
}
Table notifications {
  id bigint [pk, increment]
  recipient_user_id bigint [not null]
  type varchar [not null]
  title varchar(120) [not null]
  body varchar(255) [not null]
  help_request_id bigint [null]
  read_at datetime [null]
  created_at datetime [not null]
}
Ref: volunteer_profiles.user_id - users.id
Ref: volunteer_profiles.approved_by_user_id > users.id
Ref: help_requests.submitted_by_user_id > users.id
Ref: help_requests.request_type_id > request_types.id
Ref: help_requests.disaster_event_id > disaster_events.id
Ref: disaster_events.created_by_user_id > users.id
Ref: shelters.disaster_event_id > disaster_events.id
Ref: request_status_events.help_request_id > help_requests.id
Ref: request_status_events.actor_user_id > users.id
Ref: assignments.help_request_id > help_requests.id
Ref: assignments.volunteer_user_id > users.id
Ref: assignments.assigned_by_user_id > users.id
Ref: feedback.help_request_id - help_requests.id
Ref: feedback.assignment_id - assignments.id
Ref: feedback.submitted_by_user_id > users.id
Ref: feedback.volunteer_user_id > users.id
Ref: notifications.recipient_user_id > users.id
Ref: notifications.help_request_id > help_requests.id

--- NORMALISATION SUB-SECTION (4.5), written from this diagram, 2 pages, free ---
Give three concrete before/after pairs taken from the real old code, not textbook
examples. This is the highest-scoring cheap page in the whole report:
  1NF  — the wizard's single "phone or email" contact field split into
         help_requests.contact_phone and contact_email (one fact per column).
  2NF  — the denormalised `assignedTo: string` display name on the request row
         promoted to the ASSIGNMENTS entity, because claimed_at, progress_pct and
         hours_logged depend on the volunteer-request pair, not on the request alone.
  3NF  — `icon: IconDefinition` and `iconBgColor: 'bg-red-500'` removed from the
         request and moved to REQUEST_TYPES.icon_key / color_key: they were
         transitively dependent on the request's type, not on the request key.
         (Presentation was being stored as data.)
  Also justify the two deliberate denormalisations so they read as decisions:
  volunteer_profiles.rating_avg / completed_count / hours_logged (derived aggregates,
  kept for read performance on the volunteer dashboard) and
  feedback.volunteer_user_id (copied from the assignment so AVG(rating) per volunteer
  is one indexed scan instead of a two-table join).

---

## DFD Level 0 — context diagram

═══════════════════════════════════════════════════════════════
DFD LEVEL 0 — CONTEXT DIAGRAM (Fig 4.3)
═══════════════════════════════════════════════════════════════
Draw in diagrams.net, Shape Library -> "Flowchart" + "Gane-Sarson"
(File -> Shapes -> tick "Gane & Sarson" under Software). Gane-Sarson = rounded
rectangle for process, open-ended rectangle for data store, plain rectangle for
external entity. Use Gane-Sarson consistently across all three levels.

--- SINGLE PROCESS (centre of page, large rounded rectangle) ---
  0
  DISASTER RELIEF
  MANAGEMENT SYSTEM
  (DRMS)

--- EXTERNAL ENTITIES (plain rectangles, one per corner region) ---
  E1  VICTIM               (top-left)     — a citizen affected by a disaster
  E2  VOLUNTEER            (bottom-left)  — an approved relief worker
  E3  DISTRICT ADMINISTRATOR (right)      — the single admin / coordinator

Do NOT invent a fourth entity. There is no SMS gateway, no email service, no map
provider and no payment gateway in this system — every one of those was explicitly
cut, and drawing them would be a claim you cannot demonstrate. If an examiner asks
where the notification service is, the correct answer is "notifications are internal
rows in D10; out-of-band delivery is documented in Future Scope."

--- DATA STORES AT LEVEL 0 ---
NONE. A context diagram shows the system as one opaque process; its data stores are
internal and appear from Level 1 onward. Put this sentence in the caption so the
omission is visibly deliberate:
  "Fig 4.3 — Level 0 (context) DFD. By convention the context diagram exposes no
   internal data stores; the ten stores D1-D10 are introduced in the Level 1
   decomposition (Fig 4.4)."
(If your department's template insists on stores at level 0, add only D6 HELP_REQUESTS
and say so — do not draw all ten.)

--- DATA FLOWS (label every arrow; 14 flows total) ---

VICTIM (E1) --> 0 :
  f1   registration details (name, email, phone, password, district, terms consent)
  f2   login credentials
  f3   help request (type, urgency, district, landmark, people count, description, contact)
  f4   SOS request (type=RESCUE, urgency=CRITICAL, saved home district)
  f5   request cancellation
  f6   service feedback (rating 1-5, comments, contact permission)

0 --> VICTIM (E1) :
  f7   session + role-based dashboard (active disaster status, open request count,
       nearest open shelter, event helpline)
  f8   request acknowledgement + reference number (REQ-YYYY-NNNNNN)
  f9   request list, per-status counts and status timeline
  f10  assignment notification + assigned volunteer name and phone

VOLUNTEER (E2) --> 0 :
  f11  registration and login credentials
  f12  claim (accept) request
  f13  status update (IN_PROGRESS / AWAITING_CONFIRMATION / COMPLETED),
       progress percentage, hours logged, completion note

0 --> VOLUNTEER (E2) :
  f14  available request pool (type, urgency, people count, district, distance in km)
  f15  claim result (accepted, or "already accepted by <name>")
  f16  my assigned tasks + victim contact details (released only after acceptance)
  f17  volunteer KPIs (available nearby, assigned, completed this month, hours contributed)

DISTRICT ADMINISTRATOR (E3) --> 0 :
  f18  login credentials
  f19  user administration commands (search, approve volunteer, change role,
       activate/deactivate)
  f20  disaster event declaration (name, type, severity, centre lat/lng, radius,
       helpline, dates)
  f21  manual assignment / request filter criteria
  f22  report parameters (date range)

0 --> DISTRICT ADMINISTRATOR (E3) :
  f23  dashboard KPIs, 7-day request trend, recent system activity feed
  f24  filtered request register with pagination
  f25  user register and volunteer approval queue
  f26  help request summary report (on screen + CSV download)

--- TWO ANNOTATIONS THAT EARN MARKS ON THIS PAGE ---
  * Beside the arrow bundle f14/f16, put a small note: "progressive disclosure —
    victim identity and phone are added to the volunteer payload only after a
    successful claim."
  * Under the process box: "Single trust boundary. All three external entities reach
    the system through the same /api/v1 surface; authorisation is by role and by
    record ownership, not by which screen the request came from."

---

## DFD Level 1

═══════════════════════════════════════════════════════════════
DFD LEVEL 1 (Fig 4.4) — SIX PROCESSES, TEN DATA STORES
═══════════════════════════════════════════════════════════════
THE TRICK THAT MAKES THIS FREE: the six processes are named exactly after the six
Express routers, and the ten data stores are the ten tables. Create the routers with
these filenames in week 1 and the diagram is a transcription, not a design exercise.
Say so in the report — "the Level 1 processes correspond one-to-one with the six
route modules in backend/src/routes/, and the data stores D1-D10 with the ten tables
in db/schema.sql" — it demonstrates that design and implementation did not drift.

--- PROCESSES (numbered n.0) ---
 1.0  MANAGE ACCOUNTS AND ACCESS
        backend/src/routes/accounts.routes.ts
        (register, login, logout, session restore, profile read/edit, volunteer
         approval, role change, activate/deactivate, debounced user search)
 2.0  INTAKE HELP REQUEST
        backend/src/routes/requests.routes.ts
        (validate, resolve coordinates, auto-attach disaster event, persist, cancel,
         list with server-side filter/pagination/counts, request detail projection)
 3.0  DISPATCH AND ASSIGNMENT
        backend/src/routes/assignments.routes.ts
        (available pool with distance sort, atomic claim, admin manual assign, release)
 4.0  TRACK PROGRESS AND NOTIFY
        backend/src/routes/tracking.routes.ts
        (legal status transition check, progress + hours capture, status timeline read,
         notification list, unread count, mark read)
 5.0  CAPTURE FEEDBACK
        backend/src/routes/feedback.routes.ts
        (eligibility check, one-per-request rating, volunteer rating aggregate update)
 6.0  ADMINISTER AND REPORT
        backend/src/routes/admin.routes.ts
        (dashboard KPI aggregate, 7-day trend, activity feed, disaster event list with
         derived status + create, shelter directory, help request summary + CSV)

--- DATA STORES (open-ended rectangles, right-hand column of the page) ---
 D1  USERS                  -> users
 D2  VOLUNTEER PROFILES     -> volunteer_profiles
 D3  REQUEST TYPES          -> request_types
 D4  DISASTER EVENTS        -> disaster_events
 D5  SHELTERS               -> shelters
 D6  HELP REQUESTS          -> help_requests
 D7  REQUEST STATUS EVENTS  -> request_status_events
 D8  ASSIGNMENTS            -> assignments
 D9  FEEDBACK               -> feedback
 D10 NOTIFICATIONS          -> notifications
Reference data note on the page: the 14 Kerala district centroids are a code-level
lookup (backend/src/reference/kerala-districts.ts), not a data store — draw it as a
small dashed box labelled "R1 District centroid reference (static)" feeding 2.0 and
3.0, or omit it entirely and mention it in the caption. Do not number it D11.

--- FLOWS, PROCESS BY PROCESS (this is the whole diagram; copy it literally) ---

1.0 MANAGE ACCOUNTS AND ACCESS
  E1/E2 -> 1.0   registration details, login credentials
  E3    -> 1.0   approve volunteer, role change, activate/deactivate, search term
  1.0  -> D1     new user record, password hash, terms_accepted_at, last_login_at,
                 token_version increment on deactivation
  D1   -> 1.0    credential + role + status lookup
  1.0  -> D2     volunteer profile row on VOLUNTEER registration; approval_status,
                 approved_by_user_id, approved_at on approval
  D2   -> 1.0    approval status (read by 3.0's guard too)
  1.0  -> D10    VOLUNTEER_APPROVED notification
  1.0  -> E1/E2/E3   session cookie, authenticated identity, role-filtered menu
  1.0  -> E3     user register, volunteer approval queue

2.0 INTAKE HELP REQUEST
  E1   -> 2.0    help request form / SOS / cancellation / list filter
  D3   -> 2.0    active request types (drives the dropdown and validates the code)
  D4   -> 2.0    active disaster events + centre/radius (for auto-attach)
  D1   -> 2.0    submitter's home district and home point
  2.0  -> D6     new help_request row (status SUBMITTED), cancellation fields
  D6   -> 2.0    the caller's own requests, per-status counts, one request for detail
  2.0  -> D7     initial (NULL -> SUBMITTED) status event; (-> CANCELLED) on cancel
  D7   -> 2.0    status timeline for the detail screen
  D8   -> 2.0    active assignment (LEFT JOIN) so the detail screen can show the
                 assigned volunteer
  2.0  -> D10    REQUEST_SUBMITTED notification to the administrator
  2.0  -> E1     reference number, request list with envelope counts, request detail

3.0 DISPATCH AND ASSIGNMENT
  E2   -> 3.0    pool filter/sort criteria, CLAIM command
  E3   -> 3.0    manual assign command (volunteer chosen from approved list)
  D2   -> 3.0    approval_status gate (403 if not APPROVED)
  D1   -> 3.0    volunteer home point (distance origin), winner's name for the 409
  D6   -> 3.0    SUBMITTED pool; locked row on claim
  3.0  -> D6     status SUBMITTED -> ASSIGNED, first_assigned_at
  3.0  -> D8     new assignment row (the UNIQUE generated column decides the race)
  D8   -> 3.0    existing active assignment (to name the winner)
  3.0  -> D7     SUBMITTED -> ASSIGNED status event
  3.0  -> D10    REQUEST_ASSIGNED notification to the victim
  3.0  -> E2     pool with distance in km, claim accepted / already claimed
  3.0  -> E3     assignment confirmation

4.0 TRACK PROGRESS AND NOTIFY
  E2   -> 4.0    status transition, progress_pct, hours_logged, completion note
  E1/E2/E3 -> 4.0   notification poll (15 s) / mark-as-read
  D8   -> 4.0    current assignment status (legal-transition check reads this)
  4.0  -> D8     status, started_at / awaiting_confirmation_at / completed_at,
                 progress_pct, hours_logged, completion_notes
  4.0  -> D2     hours_logged and completed_count aggregate increment
  4.0  -> D6     status IN_PROGRESS / COMPLETED, completed_at
  4.0  -> D7     one status event per transition
  4.0  -> D10    REQUEST_STATUS_CHANGED / REQUEST_COMPLETED notification
  D7   -> 4.0    timeline
  D10  -> 4.0    unread count and notification list
  4.0  -> E1/E2/E3   status timeline, unread badge, notification dropdown

5.0 CAPTURE FEEDBACK
  E1   -> 5.0    rating, comments, contact permission
  D6   -> 5.0    ownership + COMPLETED status check
  D8   -> 5.0    the assignment being rated, and its volunteer
  5.0  -> D9     feedback row (UNIQUE help_request_id rejects a second submission)
  5.0  -> D2     rating_avg / rating_count recompute for that volunteer
  5.0  -> D10    FEEDBACK_RECEIVED notification to the volunteer
  5.0  -> E1     thank-you confirmation, or "feedback already submitted"

6.0 ADMINISTER AND REPORT
  E3   -> 6.0    dashboard load, event declaration, report date range, CSV download
  D1   -> 6.0    total users count
  D6   -> 6.0    active request count, resolved-today count, 7-day GROUP BY
                 DATE(submitted_at), type x status cross-tab
  D7   -> 6.0    recent activity feed (JOIN D1 for actor name and role)
  D8   -> 6.0    volunteers-with-active-tasks count
  D4   -> 6.0    event list with derived status
  6.0  -> D4     new disaster event row
  D5   -> 6.0    shelter directory
  6.0  -> E3     KPI cards, trend bars, activity feed, event list, shelter table,
                 summary table, CSV file

--- BALANCING CHECK (do this before you submit; examiners test it) ---
Every Level 0 flow must reappear at Level 1. Tick them off:
  f1,f2,f11,f18 -> 1.0 | f19 -> 1.0 | f3,f4,f5 -> 2.0 | f6 -> 5.0 | f12 -> 3.0
  f13 -> 4.0 | f20,f21,f22 -> 6.0 and 3.0 | f7 <- 2.0+6.0(shelters/events)
  f8,f9 <- 2.0 | f10 <- 4.0 | f14,f15 <- 3.0 | f16,f17 <- 4.0+3.0
  f23,f24,f25,f26 <- 6.0 and 1.0
Nothing is left over. Write one sentence in the report saying you verified balancing —
it is a standard SAD marking point and almost nobody claims it explicitly.

---

## DFD Level 2

═══════════════════════════════════════════════════════════════
DFD LEVEL 2 — EXPLODE EXACTLY TWO PROCESSES, NOT SIX
═══════════════════════════════════════════════════════════════
DECISION AND JUSTIFICATION (put this paragraph in the report, it pre-empts "why no
level 2 for the others?"):
  "Level 2 decomposition is provided for Process 2.0 (Intake Help Request) and
   Process 3.0 (Dispatch and Assignment) because these are the two processes whose
   internal logic is non-trivial: 2.0 performs validation, coordinate resolution and
   geographic event attachment before persisting, and 3.0 performs a concurrency-
   controlled state transition across four tables in one transaction. Processes 1.0,
   4.0, 5.0 and 6.0 are single-step create/read/update operations whose Level 1
   description is already primitive; decomposing them further would add pages without
   adding information."
A Level 2 of "Capture Feedback" is padding and an examiner notices padding.
Budget: 1.5 hours for both diagrams, week 1 day 2, immediately after the Level 1.

───────────────────────────────────────────────────────────────
Fig 4.5 — DFD LEVEL 2 FOR PROCESS 2.0 (INTAKE HELP REQUEST)
───────────────────────────────────────────────────────────────
Six sub-processes, numbered 2.1 ... 2.6. Draw them left-to-right as a pipeline;
put D3/D4/D1 above the pipeline and D6/D7/D10 below it.

 2.1  VALIDATE SUBMISSION
        In : raw form payload from E1 (VICTIM)
        Uses : Zod schema createHelpRequestSchema (backend/src/schemas/request.schema.ts)
        Rules: request_type code exists and is_active; urgency in enum; district in the
               14-value enum; people_count >= 1; description length >= 10; at least one
               of contact_phone / contact_email present and well-formed
        D3 -> 2.1 : active request type codes
        Out (reject) : 422 field-level error map -> E1
        Out (accept) : validated command -> 2.2

 2.2  RESOLVE LOCATION
        In : validated command
        D1 -> 2.2 : submitter's home_district, home_lat, home_lng
        R1 -> 2.2 : district centroid table (static reference, 14 rows)
        Rule : if the chosen district equals the submitter's saved home district and a
               home point exists, use the home point and set
               location_source = HOME_POINT; otherwise use the district centroid and
               set location_source = DISTRICT_CENTROID.
        Out : command + (lat, lng, location_source) -> 2.3
        ** Annotate this box: "no browser geolocation and no external geocoding — the
           precision of every coordinate is labelled by location_source." **

 2.3  ATTACH DISASTER EVENT
        In : command with coordinates
        D4 -> 2.3 : ACTIVE events (start_date <= NOW() AND (end_date IS NULL OR
                    end_date > NOW())) with centre lat/lng and radius_km
        Rule : select the event with the smallest
               ST_Distance_Sphere(POINT(lng,lat), POINT(center_lng,center_lat))/1000
               that is <= radius_km; NULL if none matches.
        Out : command + disaster_event_id (possibly NULL) -> 2.4

 2.4  PERSIST REQUEST          [start of transaction T1]
        2.4 -> D6 : INSERT help_requests (status = SUBMITTED, submitted_at = UTC now)
        D6 -> 2.4 : generated id
        Out : help_request_id -> 2.5

 2.5  OPEN STATUS TRAIL
        2.5 -> D7 : INSERT request_status_events (from_status NULL, to_status
                    SUBMITTED, actor = the victim, actor_role = VICTIM)
        Out -> 2.6

 2.6  ACKNOWLEDGE AND NOTIFY   [commit T1]
        2.6 -> D10 : INSERT notifications (type REQUEST_SUBMITTED) for the
                     administrator
        2.6 -> E1  : reference CONCAT('REQ-',YEAR(submitted_at),'-',LPAD(id,6,'0')),
                     toast, redirect target /requests/:id
        ** Draw a dashed boundary box around 2.4, 2.5 and 2.6 labelled
           "single database transaction (T1) — all three commit or none do". **

 (Optional 7th box if you want the cancel path on the same figure:)
 2.7  CANCEL REQUEST — D6 -> 2.7 ownership + status=SUBMITTED check;
      2.7 -> D6 status CANCELLED + cancelled_at + cancel_reason; 2.7 -> D7 status
      event; 2.7 -> E1 confirmation. Keep it in a corner, clearly separate.

───────────────────────────────────────────────────────────────
Fig 4.6 — DFD LEVEL 2 FOR PROCESS 3.0 (DISPATCH AND ASSIGNMENT)
───────────────────────────────────────────────────────────────
THIS IS THE MOST IMPORTANT DIAGRAM IN THE REPORT after the ER diagram, because it is
the picture of the concurrency story. Seven sub-processes, 3.1 ... 3.7.

 3.1  PUBLISH AVAILABLE POOL
        In : filter (request type), sort (urgency | distance | newest) from E2
        D6 -> 3.1 : help_requests WHERE status = 'SUBMITTED'
        D3 -> 3.1 : type labels, icon_key, color_key
        D1 -> 3.1 : volunteer's home_lat / home_lng (the distance origin)
        Rule : distance_km = ST_Distance_Sphere(POINT(hr.lng,hr.lat),
               POINT(?,?)) / 1000, SRID 0, longitude first
        Out -> E2 : pool cards WITHOUT victim name, phone or exact address
        ** Annotate: "PII withheld — see 3.6." **

 3.2  CHECK CLAIM ELIGIBILITY
        In : CLAIM command (volunteer id, help_request_id) from E2, or ASSIGN command
             (admin id, volunteer id, help_request_id) from E3
        D1 -> 3.2 : role and account status
        D2 -> 3.2 : approval_status
        Reject : role not VOLUNTEER/ADMIN -> 403; approval_status != APPROVED -> 403
                 with the "your volunteer account is awaiting approval" banner
        Out -> 3.3
        ** Both E2's self-claim and E3's manual assign enter the SAME box. Draw both
           arrows converging here and label the figure "one claim service, two
           entry points; assigned_by_user_id distinguishes them." **

 3.3  LOCK AND VERIFY REQUEST STATE       [begin transaction T2,
                                           innodb_lock_wait_timeout = 5 s]
        D6 -> 3.3 : SELECT ... WHERE id = ? FOR UPDATE   (current read, row lock)
        Reject : row missing -> 404; status != 'SUBMITTED' -> branch to 3.7
        Out -> 3.4
        ** Annotate: "FOR UPDATE, not a plain SELECT: MySQL's default REPEATABLE READ
           isolation would otherwise return a stale snapshot." **

 3.4  CREATE ASSIGNMENT
        3.4 -> D8 : INSERT assignments (status ASSIGNED). The STORED generated column
                    active_help_request_id is written by the engine and checked
                    against UNIQUE uq_one_active_assignment.
        On duplicate (errno 1062) : branch to 3.7
        Out : assignment_id -> 3.5

 3.5  ADVANCE REQUEST AND RECORD EVENT
        3.5 -> D6  : UPDATE status = 'ASSIGNED',
                     first_assigned_at = COALESCE(first_assigned_at, UTC now)
        3.5 -> D7  : INSERT status event SUBMITTED -> ASSIGNED with actor and role
        Out -> 3.6

 3.6  RELEASE CONTACT AND NOTIFY          [commit T2]
        3.6 -> D10 : INSERT notification REQUEST_ASSIGNED for the victim
        3.6 -> E2  : 201 + victim name, phone and exact location now included in the
                     task payload
        3.6 -> E1  : (via 4.0's poll) bell badge and timeline update
        ** Draw the dashed transaction boundary around 3.3-3.6 labelled
           "transaction T2 — assignment, request status, status event and notification
            commit atomically". This is the sentence the race test proves. **

 3.7  RESOLVE CLAIM CONFLICT              [rollback T2]
        Reached from 3.3 (status no longer SUBMITTED) or from 3.4 (ER_DUP_ENTRY 1062,
        or lock timeout 1205 / deadlock 1213)
        D8 -> 3.7 : SELECT the winner via a.active_help_request_id = ?
        D1 -> 3.7 : winner's first name + last initial
        Out -> E2 : 409 { code: ALREADY_CLAIMED, message: "Already accepted by Arun K." }
        ** Annotate: "two independent paths reach 3.7 — a lost row lock and a rejected
           unique index — and both produce the identical response." **

───────────────────────────────────────────────────────────────
BALANCING BETWEEN LEVEL 1 AND LEVEL 2
Every arrow crossing the boundary of the 2.0 bubble at Level 1 must appear on Fig 4.5,
and likewise 3.0 on Fig 4.6. Check the store list: Fig 4.5 touches D1, D3, D4, D6, D7,
D10 — identical to 2.0's store list at Level 1. Fig 4.6 touches D1, D2, D3, D6, D7,
D8, D10 — identical to 3.0's. State that you checked it.

DO NOT number anything 3.4.1 — there is no Level 3 in this report and adding one is
a week you do not have.

---

## UML

- BUILD EXACTLY FOUR UML DIAGRAMS, NOT TWELVE. The rubric line is 'ER diagram and DFDs'; UML is supporting evidence, so each one must earn its page. Four is roughly 3 hours total with PlantUML/Mermaid, and each of the four answers a question the ER diagram and DFDs cannot.
- (1) USE CASE DIAGRAM — Section 3.7, Fig 3.1, PlantUML, ~30 minutes. Three actors: Victim, Volunteer, District Administrator. Victim: Register, Log In, Submit Help Request, Raise SOS, View My Requests, View Request Detail, Cancel Request, Submit Feedback, View Notifications. Volunteer: Register, Log In, Browse Available Requests, Claim Request, Update Task Status, Log Hours, View Assigned Tasks, View Notifications. Administrator: Log In, Approve Volunteer, Manage Users, View All Requests, Assign Request Manually, Declare Disaster Event, View Dashboard, Generate Summary Report. Draw 'Authenticate' as a single use case with <<include>> arrows from every other use case (or state the assumption in a note to avoid 18 arrows). Add one <<extend>> from 'Claim Request' to 'Handle Claim Conflict' — that single extend is the diagram's one interesting line and it foreshadows Chapter 4.7. Actor generalisation: do NOT draw a generic 'User' superactor; the three roles have disjoint permission sets and the diagram is clearer without it.
- (2) SEQUENCE DIAGRAM — THE CLAIM RACE — Section 4.7, Fig 4.9, Mermaid, ~45 minutes. This is the highest-value UML diagram in the report because it is the only artifact that shows the concurrency story as a time-ordered picture. Lifelines: Volunteer A (browser), Volunteer B (browser), Express API, ClaimService, MySQL. Show A's POST /claim, `SET SESSION innodb_lock_wait_timeout=5`, BEGIN, `SELECT ... FOR UPDATE` acquiring the row lock; then B's POST arriving and BLOCKING on the same SELECT (draw B's activation bar as a dashed/greyed region labelled 'blocked on row lock'); then A's INSERT assignment, UPDATE help_request, INSERT status_event, INSERT notification, COMMIT; then B's lock granted, current read returns status='ASSIGNED', ROLLBACK, lookup of the winner's name, 409 ALREADY_CLAIMED. Add a Mermaid `Note over MySQL` reading 'UNIQUE(active_help_request_id) would reject B even if the lock were bypassed'. Put the transaction boundaries in as `rect` blocks.
- (3) STATE CHART / STATE TRANSITION DIAGRAM — Section 4.8, Fig 4.8, Mermaid stateDiagram-v2, ~30 minutes. TWO charts on one page, side by side, because the two status vocabularies belong to two different entities and showing that is the point. Chart A, help_requests.status: [*] -> SUBMITTED -> ASSIGNED -> IN_PROGRESS -> COMPLETED -> [*], with SUBMITTED -> CANCELLED and ASSIGNED/IN_PROGRESS -> CANCELLED (admin only) as the alternate terminal. Label every transition with the triggering role and endpoint, e.g. 'volunteer: POST /requests/:id/claim'. Chart B, assignments.status: [*] -> ASSIGNED -> IN_PROGRESS -> AWAITING_CONFIRMATION -> COMPLETED -> [*], plus ASSIGNED/IN_PROGRESS -> RELEASED -> [*]. SHADE the three states {ASSIGNED, IN_PROGRESS, AWAITING_CONFIRMATION} as a composite region labelled 'ACTIVE — active_help_request_id is non-NULL and holds the unique slot'; the two unshaded terminal states are where the column goes NULL and the slot is freed. That shaded region turns the generated-column trick from a paragraph into a picture, and it is a strong viva prop. Finally, mark the ASSIGNED -> COMPLETED arrow that does NOT exist with a red crossed line annotated 'rejected, HTTP 400 — see TC-TRN-10'.
- (4) ACTIVITY DIAGRAM — the end-to-end relief workflow with swimlanes — Section 4.3, Fig 4.11, PlantUML, ~40 minutes. Three vertical swimlanes: Victim | Volunteer | Administrator, plus a fourth narrow lane 'System' if it helps. Flow: Victim submits request -> System validates -> decision diamond 'inside an active event radius?' -> attach event / leave unattached -> request enters pool -> Volunteer browses -> decision 'approved volunteer?' -> claim -> decision 'still SUBMITTED?' -> [no] show conflict, return to pool -> [yes] assignment created -> Volunteer works -> status transitions -> completion with hours -> Victim rates -> Administrator sees it in the dashboard aggregate. This single figure is the best answer to 'walk me through your system' and it doubles as your demo-script map.
- OPTIONAL FIFTH IF YOU HAVE A SPARE HOUR AND NOT OTHERWISE: a DEPLOYMENT DIAGRAM for Chapter 5 — one node 'Developer laptop (Windows 11)' containing an execution environment 'Node 24 process' (artifacts: Express API, dist/frontend/browser static bundle) and a Docker engine node containing 'mysql:8.0 container' and 'adminer container', with the named volume drawn as a persistent store. It is 20 minutes and it makes the localhost-deployment decision look designed rather than defaulted. Label the single origin http://localhost:3000 explicitly — that annotation IS the same-origin-cookie argument.
- DELIBERATELY SKIP: the class diagram (you have no OO domain model — you have repository functions over SQL rows, and a class diagram would misrepresent the architecture; say so in one sentence if asked), the collaboration/communication diagram (redundant with the sequence diagram), the object diagram, the package diagram (the module hierarchy chart already covers it), and any second or third sequence diagram. If your department mandates a class diagram, draw the TypeScript DTO interfaces and service classes as they actually exist and label it 'Fig 4.x — Service and DTO structure' rather than pretending to a domain model you did not build.

---

## Report chapters

| Chapter | Pages | Written from | When |
|---|---:|---|---|
| Front Matter — Title page, Bonafide Certificate, Declaration, Acknowledgement, Abstract, Table of Contents, List of Figures, List of Tables, List of Abbreviations | 10 | College template + the agreed scopeStatement (abstract) + Word's auto-TOC over the finished body | Week 4, day 5 — LAST. Regenerate the TOC and both lists after the final page-number pass. The abstract can be drafted in week 1 from the scope statement and then tightened. |
| Chapter 1 — Introduction | 6 | The agreed scopeStatement and the `cut` list; scratchpad/scope.md MUST-HAVE section | Week 1, day 3 (2 hours). Objectives must be frozen before you start coding — they are the spine every later chapter hangs on, and rewriting them in week 4 forces edits in four other chapters. |
| Chapter 2 — Literature Survey / Study of Existing Systems | 9 | NONE — this is the only chapter with no build artifact behind it. That is precisely why it is scheduled first. | Week 1, days 4-6 (6-7 hours, split across evenings). WRITE IT IN WEEK 1 OR IT WILL NOT GET WRITTEN. Every other chapter can be transcribed from a file in week 4; this one cannot, so it is the chapter that gets crushed to two thin pages if you defer it. Collect 12-15 references while you write and paste them straight into Chapter 9 as you go. |
| Chapter 3 — System Analysis | 12 | backend/src/schemas/*.ts (Zod) for the functional requirements; backend/src/middleware/auth.ts for the security requirements; scratchpad/screen-survey.md for the existing-system defect list | Sections 3.1-3.4 and 3.6 in Week 1 day 7 (3 hours) — they need no code. Section 3.5 in Week 4 day 1 (3 hours), transcribed from the finished Zod schemas. Section 3.7 use cases in Week 2 once the routes are real. Writing 3.5 early guarantees it drifts from the code; writing it last makes it accurate for free. |
| Chapter 4 — System Design | 26 | db/schema.sql (4.6, 4.7), backend/src/routes/*.ts (4.3, 4.4), backend/src/schemas (4.9), the ER and DFD source files in docs/diagrams/ | SPLIT. Week 1 day 2: draw and export all four DFDs and the ER diagram (4.4, 4.5) the moment db/schema.sql runs clean — they fall out of the frozen schema and the router filenames while both are fresh, and having them on your wall makes week 2 faster. Week 2 end: write 4.7 the day the claim transaction and the race test both pass, while the reasoning is in your head. Week 3: 4.1-4.3, 4.8-4.12. Week 4 day 2: transcribe 4.6 from the final schema.sql (2 hours, mechanical). |
| Chapter 5 — System Implementation | 14 | backend/src/services/claim.service.ts, backend/src/middleware/auth.ts, docker-compose.yml, frontend/src/app/app.config.ts, frontend/src/app/core/interceptors/*.ts | Week 4, days 1-2 (5 hours). This chapter is genuinely written from finished code, so writing it early means rewriting it. The one exception: keep a running docs/implementation-notes.md from week 1 — every time you hit and solve something awkward (the CLI shadowing, the SRID order, the Express 5 wildcard, error 3105 on the generated column), write two lines into it that evening. In week 4 that file IS this chapter. |
| Chapter 6 — System Testing | 9 | backend/test/*.test.ts and the captured `npm test` terminal output; docs/implementation-notes.md for the defect log | Week 4, day 3 (3 hours), immediately after the twelve tests go green — copy the runner output straight into 6.4's Actual column and screenshot the terminal the same hour. Write 6.1-6.3 first (they need no results) if you want a head start in week 3. |
| Chapter 7 — Results and Discussion (Screenshots) | 16 | The running application at http://localhost:3000 against the seeded database, plus Adminer at :8080 | CAPTURE CONTINUOUSLY, WRITE IN WEEK 4 DAY 4. The moment a screen first works properly — week 1 for login/registration/role landing, week 2 for the core loop, week 3 for admin — take the screenshot that evening and file it in docs/screenshots/ with the final filename. Reason: on demo week the seed data changes and you will have to recreate states you have already destroyed. In week 4 you only re-take the 5-6 shots that changed, then write captions for 2 hours. |
| Chapter 8 — Conclusion and Future Scope | 6 | The agreed `cut` list and `vivaTalkingPoints` — these are already written, this chapter is largely an edit | Week 4, day 4 (2 hours). Easy and fast because the source material exists; do it after the screenshots when you are tired. |
| Chapter 9 — Bibliography / References | 3 | Collected continuously while writing Chapter 2 and while solving MySQL problems in weeks 1-2 | Accumulate from week 1. Keep docs/references.md open and paste every URL you actually used the moment you use it. Format it into the final style in week 4 day 5 (45 minutes). Never reconstruct a bibliography from memory at the end — you will cite things you did not read and omit the MySQL manual pages that prove you did the hard part. |
| Appendix A — Database Schema Listing | 9 | db/schema.sql | Week 4, day 5. Pure copy-paste, 20 minutes, done at the very end so it matches the final schema. |
| Appendix B — Key Source Code Listings | 8 | The four named source files | Week 4, day 5. Copy-paste, 20 minutes. |

### Chapter contents

#### Front Matter — Title page, Bonafide Certificate, Declaration, Acknowledgement, Abstract, Table of Contents, List of Figures, List of Tables, List of Abbreviations

- Title page and certificate: use the college template verbatim, do not redesign it
- Abstract, 250-300 words: compress the agreed scopeStatement into one paragraph, then one sentence on the technical centrepiece (database-enforced single-active-assignment) and one on the deliberate exclusions
- Table of Contents: generate with Word's Insert > Table of Contents after applying Heading 1/2 styles — never type it by hand, you will renumber twice
- List of Figures: 14 entries (Fig 4.1 architecture, 4.2 ER, 4.3 DFD-0, 4.4 DFD-1, 4.5 DFD-2 intake, 4.6 DFD-2 dispatch, 4.7 use case, 4.8 request state chart, 4.9 claim sequence, 4.10 module hierarchy, plus screenshot figures numbered 7.x)
- List of Tables: 10 table-structure tables + the test case table + the feasibility table + the hardware/software table
- List of Abbreviations: DRMS, SPA, API, REST, JWT, RBAC, PII, DPDP, SRS, DFD, ER, ACID, CRUD, CSV, KSDMA, NDMA

#### Chapter 1 — Introduction

- 1.1 Overview of the domain: disaster relief coordination in Kerala; the 2018 and 2019 Kerala floods, Cyclone Remal, the Wayanad and Idukki landslides — cite the KSDMA and NDMA context so the project reads as locally grounded rather than generic
- 1.2 Problem statement: during a surge, help requests arrive faster than any manual roster can allocate, and the failure mode that matters is not a lost request but a DOUBLE-DISPATCHED one — two volunteers sent to the same household while another household waits. Name this in chapter 1 so chapters 4, 5 and 6 are visibly answering a question you asked on page 1
- 1.3 Objectives, as a numbered list of exactly 7 — each one must map to something you can demo: (1) unified role-based access for victim, volunteer and administrator; (2) located help request intake with automatic attachment to the governing disaster event; (3) volunteer self-service claiming with a database-enforced guarantee of at most one active assignment per request; (4) a server-validated status lifecycle with an append-only audit trail; (5) in-app notification of every state change; (6) victim feedback constrained to one rating per completed request; (7) an administrative console with aggregate reporting and CSV export
- 1.4 Scope and limitations: reproduce the scopeStatement, then the exclusion list in one honest paragraph (no SMS/email/push, no file upload, no interactive mapping, no external geocoding, no cloud deployment) with a forward reference to Chapter 8
- 1.5 Organisation of the report: one sentence per chapter

#### Chapter 2 — Literature Survey / Study of Existing Systems

- 2.1 Government and institutional systems: NDMA's SACHET common-alerting platform and the CAP-based warning dissemination model; the India Disaster Resource Network (IDRN) inventory approach; KSDMA's district-level coordination and the Rebuild Kerala Development Programme. Point: these are BROADCAST-and-INVENTORY systems — one-to-many alerting and resource cataloguing — with no per-household request lifecycle and no citizen-facing intake
- 2.2 Civic and open-source platforms: Sahana Eden (modular humanitarian management, organisation-registry oriented, heavy deployment footprint); Ushahidi/Crowdmap (crowdsourced incident mapping, map-centric, no assignment accountability); Google Person Finder (single-purpose reunification); the volunteer-built keralarescue.in during the 2018 floods — the closest analogue to this project, and the one whose documented pain point (duplicate volunteer dispatch to the same request) motivates the central design decision here
- 2.3 Comparative analysis table — 6 columns x 6 rows: System | Primary purpose | Citizen intake | Volunteer assignment model | Concurrency handling | Deployment cost. The last two columns are where DRMS earns its row
- 2.4 Technology review: why a single-page application over server-rendered pages; why relational MySQL over a document store for a workflow with a hard uniqueness invariant; review of the concurrency-control literature at the level of pessimistic row locking (SELECT ... FOR UPDATE) versus declarative uniqueness constraints, and why this project uses BOTH
- 2.5 Identified gap and how DRMS addresses it: a free, zero-infrastructure, district-scale request-to-resolution workflow with accountability enforced at the storage layer
- 2.6 Summary

#### Chapter 3 — System Analysis

- 3.1 Existing system: manual coordination via WhatsApp groups, phone trees and spreadsheets during a district-level event; enumerate its specific defects — no single register of requests, no record of who accepted what, duplicate dispatch, no closure evidence, no audit trail, contact details circulated in plaintext group chats
- 3.2 Limitations of the existing system, as a numbered list that maps 1:1 onto your 7 objectives
- 3.3 Proposed system: narrative walkthrough of the golden thread (submit -> claim -> progress -> complete -> rate), then the role matrix
- 3.4 Feasibility study, 3 subsections with real numbers rather than platitudes — TECHNICAL: Node 24, Angular 20, MySQL 8 in Docker, all verified on the development machine, all open source; ECONOMIC: total monetary cost INR 0, itemise it (MySQL Community, Docker Desktop personal use, VS Code, MySQL Workbench, diagrams.net all free; hosting cost avoided by localhost deployment), and give the notional cost had it been cloud-hosted; OPERATIONAL: single administrator per district, volunteers need no training beyond a browser, the system degrades to the existing phone process if unavailable
- 3.5 Software Requirements Specification — 3.5.1 Functional requirements, numbered FR-1 ... FR-~34, grouped by the six Level-1 processes. TRANSCRIBE THESE FROM backend/src/schemas/*.ts: each Zod schema is literally a numbered requirement with its field constraints already written ('FR-12: The system shall accept a help request specifying request type, urgency, district, landmark text, people count >= 1, and a description of at least 10 characters'). 3.5.2 Non-functional requirements: response time under 500 ms on the seeded dataset, concurrency correctness under 10 simultaneous claims (forward-reference test TC-CLM-08), availability, usability, maintainability. 3.5.3 Security requirements: bcrypt cost 12, httpOnly SameSite=Lax session cookie, deny-by-default authorisation on the whole /api/v1 router, parameterised queries, progressive PII disclosure, DPDP Act 2023 consent capture via terms_accepted_at
- 3.6 Hardware and software requirements table (development machine actual specs; minimum client = any browser released after 2023)
- 3.7 Use case diagram (Fig 4.7 may live here instead — 3 actors, ~18 use cases, with <<include>> on 'Authenticate') and 3-4 expanded use case descriptions in the standard template (actor, precondition, main flow, alternate flow, postcondition) for: Submit Help Request, Claim Help Request, Update Task Status, Submit Feedback

#### Chapter 4 — System Design

- 4.1 Design objectives and architectural style: three-tier, SPA client / stateless REST API / relational store, with the same-origin decision stated explicitly (one Node process serves both the built Angular bundle and /api/v1, which eliminates CORS and keeps the session cookie first-party)
- 4.2 System architecture diagram (Fig 4.1): browser (Angular 20 standalone components, signal facades, HTTP interceptors) -> Express 5 (router -> requireAuth/requireRole -> controller -> Zod validation -> service -> repository) -> mysql2 pool -> MySQL 8 in Docker. Label the layers with the actual folder names so the reader can find them in the source
- 4.3 Module design: six backend modules named after the six routers, and the Angular feature-folder hierarchy. Include a module hierarchy chart (Fig 4.10)
- 4.4 Data flow diagrams: Fig 4.3 (Level 0 context), Fig 4.4 (Level 1, six processes, ten stores), Fig 4.5 (Level 2 of 2.0 Intake), Fig 4.6 (Level 2 of 3.0 Dispatch), each with the caption text given in the DFD plan, plus the explicit balancing statement
- 4.5 ER diagram (Fig 4.2) + entity/relationship narrative + the M:N-resolved-by-ASSIGNMENTS paragraph + normalisation to 3NF with the three concrete before/after pairs (contact field split, assignedTo string promoted to an entity, icon/colour moved to request_types) and the two justified denormalisations
- 4.6 Table structures — ten sub-tables, one per entity, columns: Field | Data type | Constraint | Description. TRANSCRIBE FROM db/schema.sql. This is 8-10 pages of the report produced by reformatting a file you already wrote; do it with a script if you like, but do reformat it into tables rather than pasting SQL, because the SQL itself goes in Appendix A
- 4.7 Design of the concurrency control (1.5 pages, and the most distinctive pages in the report): the requirement, why a Postgres partial unique index is unavailable in MySQL, the STORED generated column workaround, the DDL, the four-step proof that it enforces the invariant, and why SELECT ... FOR UPDATE is used alongside it rather than instead of it. Include the claim sequence diagram (Fig 4.9) showing two volunteers racing
- 4.8 State chart for help_requests.status (Fig 4.8): SUBMITTED -> ASSIGNED -> IN_PROGRESS -> COMPLETED with CANCELLED as an alternate terminal, annotated with which role may trigger each transition; plus the assignment sub-state AWAITING_CONFIRMATION and RELEASED. Explicitly mark the illegal transition ASSIGNED -> COMPLETED that test TC-TRN-10 proves the server rejects
- 4.9 Interface design: the list envelope { items, page, pageSize, total, counts }, the uniform error shape { error: { code, message } }, and the HTTP status code contract (400/401/403/404/409/422)
- 4.10 Input design: the three-step wizard's field-by-field validation table. 4.11 Output design: the request detail projection per role, and the CSV report column list
- 4.12 Database security design: parameterised statements, the INSERT/SELECT-only grant on request_status_events, ON DELETE RESTRICT on history-bearing foreign keys

#### Chapter 5 — System Implementation

- 5.1 Development environment and tools: Node 24.13.1, Angular CLI 20.1.6 pinned via npm scripts and .nvmrc, TypeScript strict mode with strictTemplates, MySQL 8.0 via docker-compose, Adminer, VS Code. State the CLI-shadowing problem and how you pinned it — it is a real engineering note
- 5.2 Database setup and the reset story: docker-compose.yml with two services, schema.sql and seed.sql mounted into /docker-entrypoint-initdb.d, the container started with --default-time-zone=+00:00, and 'docker compose down -v && up -d' as both the migration mechanism and the demo reset. Explain why drop-and-recreate rather than a migration tool (no production data; DDL is not transactional in MySQL)
- 5.3 Backend implementation: the layered request path with one real endpoint traced end to end (route -> requireAuth -> requireRole -> Zod parse -> service -> repository -> mysql2 prepared statement -> DTO). Include the requireAuth deny-by-default code with its explicit public allowlist
- 5.4 Implementation of the atomic claim: the annotated claim.service.ts transaction, the errno branch table (1062 / 1205 / 1213 / 1452 / 3819 and their HTTP mappings), and the loser's 409 payload
- 5.5 Frontend implementation: standalone components with loadComponent lazy routes, signal-based facade services, the three functional interceptors (credentials, error, and the 401->login / 403->forbidden / 409->toast / 422->field-errors mapping), provideAppInitializer session restore, and authGuard/roleGuard/guestGuard
- 5.6 Reactive forms: the registration cross-field password-match validator and the three-step wizard as one typed FormGroup with nested groups, per-step validation and sessionStorage draft persistence
- 5.7 Geospatial distance without PostGIS: ST_Distance_Sphere on SRID-0 POINT(lng,lat) built from DECIMAL(9,6) columns, the district centroid reference file, and the SRID 4326 latitude-first trap stated as a hazard you avoided
- 5.8 Notification delivery by polling: 15-second interval, paused on document.hidden, with a manual refresh control; and the justification (correctness lives in the unique index, so a stale list is harmless)
- 5.9 Same-origin production serving: express.static over dist/frontend/browser plus a TERMINAL app.use() SPA fallback mounted after the API router, with the note that Express 5's path-to-regexp v8 makes app.get('*') throw at startup
- 5.10 Sample code listings: 5-6 listings of 15-30 lines each, each with a two-sentence explanation. Do not paste whole files here — whole files go to Appendix B

#### Chapter 6 — System Testing

- 6.1 Testing objectives and strategy: state the deliberate allocation — zero frontend unit tests, twelve backend integration tests — and defend it in three sentences ('a test asserting a component renders an <h1> catches nothing; a test firing ten concurrent claims at one request and asserting exactly one success catches the class of defect that causes real harm'). Examiners reward a defended strategy over an undefended count
- 6.2 Levels of testing applied: unit (Zod schema validation, the legal-transition function), integration (Supertest against a live seeded MySQL container — the twelve cases), system (the end-to-end demo path exercised manually), and user acceptance (the four-role walkthrough). Be honest about what you did not do (no automated UI tests, no load testing) and say why
- 6.3 Test environment: node:test + Supertest, a dedicated drms_test schema recreated before each run, seeded fixtures, and how the concurrency test is driven with Promise.all
- 6.4 Test case table — the twelve rows given in the test case plan, in the standard six-column format. This is the graded centrepiece of the chapter
- 6.5 Additional manual/UI test cases: a second, shorter table of 8-10 rows for things Supertest cannot see (step validation blocks Next, the cross-field password mismatch shows inline, the sidebar renders different menus per role, the bell badge increments within 15 s, the CSV opens in Excel)
- 6.6 Test execution summary: total cases, passed, failed, pass percentage, and a screenshot of the actual green `npm test` terminal output as a figure
- 6.7 Defects found and resolved: 4-6 REAL entries from your own development (e.g. 'the seed's literal dates made Resolved Today read 0 — fixed by converting every seeded timestamp to DATE_SUB(NOW(), INTERVAL n DAY)'; 'INSERT INTO assignments VALUES (...) raised error 3105 because the generated column was implicitly targeted — fixed by requiring explicit column lists'). A defect log with real entries is far more convincing than an empty one, and 'no defects found' reads as 'no testing done'

#### Chapter 7 — Results and Discussion (Screenshots)

- One figure per screenshot, numbered Fig 7.1 ... Fig 7.28, each with a caption of one or two sentences that says what the reader should notice — NOT just the screen name. Bad: 'Fig 7.9 Available Requests'. Good: 'Fig 7.9 — Volunteer available-request pool. Requests are sorted by urgency (ENUM ordinal order) and show a real distance computed with ST_Distance_Sphere from the volunteer's registered home point. The victim's name and telephone number are deliberately absent at this stage.'
- Group the figures into 7.1 Authentication and access control, 7.2 Victim workflow, 7.3 Volunteer workflow, 7.4 Administrator console, 7.5 Concurrency and error handling, 7.6 Database evidence
- Section 7.5 is the one most reports omit and it is where marks are: the 409 already-claimed toast, the Forbidden page after a victim types an admin URL, the inline 422 field errors, the illegal-transition 400, the duplicate-feedback 409, and the Adminer view of assignments showing exactly one non-NULL active_help_request_id
- 7.7 Discussion: two pages comparing the delivered system against the seven Chapter 1 objectives in a table (Objective | How met | Evidence figure/test), then an honest paragraph on the two known limitations that matter (the volunteer approval gate becomes a bottleneck precisely during a surge; district-centroid coordinates are accurate to the district, which location_source labels honestly)

#### Chapter 8 — Conclusion and Future Scope

- 8.1 Conclusion: restate the seven objectives as achieved, in the past tense, with one clause of evidence each. Two paragraphs, no new claims
- 8.2 Learning outcomes, one short paragraph, concrete: translating a Postgres-shaped design to MySQL, database-level invariant enforcement versus application checks, transaction isolation and its practical consequence for read-then-write paths, and scope arbitration under a fixed deadline
- 8.3 Future Scope — THIS IS NOT A FILLER SECTION, IT IS THE `cut` LIST WEAPONISED. Write 10-12 numbered items, each with two or three sentences saying what it is, why it was excluded, and what it would take. Being able to enumerate deliberately-dropped features with a technical reason for each is the single strongest move in a viva; 'I ran out of time' throws the same mark away. Cover: (1) SMS/IVR intake — the source ENUM column already exists so the gateway is an adapter, not a rewrite, but TRAI DLT registration is a one-to-three-week regulatory item requiring a registered entity and per-template approval, not engineering work; (2) email notification and password reset via a transactional outbox; (3) photo attachments with EXIF stripping and object storage; (4) interactive mapping with Leaflet and a self-hosted tile source; (5) refresh-token rotation with token families and reuse detection, and why a single 12-hour session was chosen instead; (6) argon2id password hashing in place of bcrypt cost 12; (7) CSRF double-submit tokens, required the day the API moves to a separate origin and SameSite becomes None; (8) UUIDv7 stored as BINARY(16) as defence in depth over the existing server-side ownership checks; (9) server-sent events replacing the 15-second poll, a one-day change with zero schema impact; (10) multi-district tenancy and a COORDINATOR role; (11) i18n into Malayalam and Hindi, already unblocked by the utf8mb4 charset choice; (12) cloud deployment and CI. Each of these should read as a costed decision
- 8.4 Closing paragraph

#### Chapter 9 — Bibliography / References

- 15-20 entries in one consistent style (IEEE numeric is easiest to keep tidy). Mix: official documentation (MySQL 8.0 Reference Manual sections on generated columns, InnoDB locking and transaction isolation, and spatial functions; Angular, Express, Node docs), standards and legislation (the Digital Personal Data Protection Act 2023; the Disaster Management Act 2005), institutional sources for Chapter 2 (NDMA, KSDMA, Sahana Foundation, Ushahidi), and 3-4 textbook/journal entries on database concurrency control and software engineering
- Cite the MySQL manual sections by name, not just a bare URL — 'MySQL 8.0 Reference Manual, Section 13.2.9: Secondary Indexes and Generated Columns' reads as though you read it, because you did
- Include access dates for every web source

#### Appendix A — Database Schema Listing

- db/schema.sql reproduced verbatim in a monospaced 9pt font, with the assignments table's generated column and unique index on its own page if possible
- A short preamble noting that this file is executed by MySQL's docker-entrypoint-initdb.d on first container start, i.e. the listing IS the deployed schema, not a description of it

#### Appendix B — Key Source Code Listings

- backend/src/services/claim.service.ts (the atomic claim transaction, complete)
- backend/src/middleware/auth.ts (requireAuth with the public allowlist, and requireRole)
- backend/src/schemas/request.schema.ts (the Zod validation that Chapter 3.5 was transcribed from)
- scripts/race-test.mjs (the ten-parallel-claim harness)
- Optionally: db/seed.sql's relative-timestamp section, to show the DATE_SUB(NOW(), INTERVAL n DAY) technique
- Do NOT append the whole codebase. Four to five files chosen because the report refers to them is a deliberate appendix; 200 pages of Angular templates is padding and dilutes everything else

---

## Test case table

═══════════════════════════════════════════════════════════════
SECTION 6.4 — TEST CASE TABLE
═══════════════════════════════════════════════════════════════

FORMAT (8 columns; landscape-rotate this page in Word, or drop the Module column if
your template forbids landscape). Column widths that actually fit A4 landscape:
  Test ID 14mm | Module 22mm | Description 46mm | Input 58mm | Expected Result 58mm |
  Actual Result 40mm | Status 14mm | Ref 16mm

The "Ref" column holds the test filename and case name — it is what converts this
table from a claim into evidence, because the examiner can open the file. Add a line
under the table: "All twelve cases are automated with node:test and Supertest against
a freshly seeded MySQL 8.0 container; the execution transcript appears in Fig 6.1."

HOW TO FILL THE "ACTUAL RESULT" COLUMN HONESTLY: run `npm test` once, copy the real
observed value (status code, row count, message text) into each row. Do not write
"As expected" twelve times — write the actual value. It takes ten extra minutes and it
is the difference between a table that looks executed and one that looks invented.

───────────────────────────────────────────────────────────────
Table 6.1 — Integration test cases and results
───────────────────────────────────────────────────────────────

| Test ID | Module | Description | Input | Expected Result | Actual Result | Status | Ref |
|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | 1.0 Accounts | Registration must reject an email that already exists, enforced by the UNIQUE index on users.email and not by a pre-check SELECT | POST /api/v1/auth/register with email `priya.nair@example.com` (already seeded), password `Test@1234`, role VICTIM, terms accepted | HTTP 409 with body `{error:{code:"EMAIL_IN_USE"}}`; users row count unchanged at 18 | 409 EMAIL_IN_USE; SELECT COUNT(*) FROM users = 18 | PASS | auth.test.ts :: duplicate email |
| TC-AUTH-02 | 1.0 Accounts | Login with a valid email and wrong password must fail with a GENERIC message so the response cannot be used to enumerate registered users | POST /api/v1/auth/login, email `priya.nair@example.com`, password `WrongPass99` | HTTP 401, message exactly `Invalid email or password`; identical message and timing for an unregistered email; no Set-Cookie header | 401 `Invalid email or password`; no session cookie issued; same message returned for `nobody@example.com` | PASS | auth.test.ts :: wrong password generic |
| TC-AUTH-03 | 1.0 Accounts | Brute-force protection: express-rate-limit on the login route only | Six consecutive POST /api/v1/auth/login with a wrong password from one IP within the window | Attempts 1-5 return 401; attempt 6 returns HTTP 429 with a Retry-After header | Attempts 1-5 = 401; attempt 6 = 429, Retry-After: 900 | PASS | auth.test.ts :: login rate limit |
| TC-SEC-04 | 1.0 Accounts | Deny-by-default authorisation: requireAuth is mounted on the entire /api/v1 router with an explicit public allowlist, so an unprotected route fails closed | GET /api/v1/requests with NO session cookie | HTTP 401 `{error:{code:"UNAUTHENTICATED"}}`; no data in the body | 401 UNAUTHENTICATED; body contains no items array | PASS | rbac.test.ts :: no cookie |
| TC-RBAC-05 | 1.0 Accounts | Role-based access control is enforced on the server, not by hiding menu items: a VICTIM must not reach an administrative endpoint | GET /api/v1/admin/users with a valid session cookie for VICTIM `priya.nair@example.com` | HTTP 403 `{error:{code:"FORBIDDEN"}}`; no user records returned | 403 FORBIDDEN; response body has no user data | PASS | rbac.test.ts :: victim on admin route |
| TC-RBAC-06 | 2.0 Intake | Record-level ownership scoping: one victim must not be able to read another victim's help request by guessing its sequential id | GET /api/v1/requests/12 with victim A's cookie, where request 12 was submitted by victim B | HTTP 403; response contains no description, contact_phone or location_text belonging to victim B | 403 FORBIDDEN; body `{error:{code:"FORBIDDEN"}}` only | PASS | rbac.test.ts :: cross-victim read |
| TC-VAL-07 | 2.0 Intake | Server-side Zod validation rejects a payload the browser form would have blocked, proving validation is not client-only | POST /api/v1/requests with `peopleCount: 0`, `description: "help"` (4 chars), type MEDICAL, district ERNAKULAM | HTTP 422 with a field-level error map naming BOTH `peopleCount` (min 1) and `description` (min 10); no help_requests row inserted | 422; errors `{peopleCount:"Must be at least 1", description:"Must be at least 10 characters"}`; row count unchanged | PASS | validation.test.ts :: invalid create |
| TC-CLM-08 | 3.0 Dispatch | **CONCURRENCY — THE CENTRAL TEST.** Ten simultaneous claim requests against one SUBMITTED help request must produce exactly one assignment, and the whole transaction (assignment + status change + status event + notification) must be atomic | Ten parallel `POST /api/v1/requests/46/claim` issued with Promise.all from ten approved-volunteer sessions | Exactly one HTTP 201 and nine HTTP 409 ALREADY_CLAIMED; `SELECT COUNT(*) FROM assignments WHERE active_help_request_id=46` = 1; `COUNT(*) FROM request_status_events WHERE help_request_id=46 AND to_status='ASSIGNED'` = 1; `COUNT(*) FROM notifications WHERE help_request_id=46 AND type='REQUEST_ASSIGNED'` = 1; help_requests.status = 'ASSIGNED' | 1 x 201, 9 x 409 ALREADY_CLAIMED; active assignments = 1; ASSIGNED status events = 1; notifications = 1; status = ASSIGNED | PASS | claim.test.ts :: ten parallel claims |
| TC-CLM-09 | 3.0 Dispatch | The volunteer approval gate is enforced by the server on the claim endpoint, not merely by hiding the button | POST /api/v1/requests/47/claim with the session of volunteer `nikhil.raj@example.com` whose volunteer_profiles.approval_status = 'PENDING' | HTTP 403 `{error:{code:"NOT_APPROVED"}}` with an explanatory message; no assignments row created | 403 NOT_APPROVED, "Your volunteer account is awaiting administrator approval"; assignments unchanged | PASS | claim.test.ts :: unapproved volunteer |
| TC-TRN-10 | 4.0 Tracking | The status lifecycle is validated on the server: a volunteer cannot skip from ASSIGNED straight to COMPLETED | PATCH /api/v1/assignments/31/status with `{status:"COMPLETED", hoursLogged:2.5}` while the assignment is still ASSIGNED | HTTP 400 `{error:{code:"ILLEGAL_TRANSITION"}}` naming the allowed next states; assignment status still ASSIGNED; no new request_status_events row | 400 ILLEGAL_TRANSITION, "ASSIGNED may only advance to IN_PROGRESS or RELEASED"; status unchanged; event count unchanged | PASS | transition.test.ts :: illegal jump |
| TC-FBK-11 | 5.0 Feedback | One rating per request is guaranteed by a UNIQUE index, so a repeated submission is rejected by the database (ER_DUP_ENTRY 1062) and mapped to 409 | POST /api/v1/requests/46/feedback `{rating:5}` twice in succession with the submitting victim's cookie | First call HTTP 201; second call HTTP 409 `{error:{code:"FEEDBACK_EXISTS"}}`; `SELECT COUNT(*) FROM feedback WHERE help_request_id=46` = 1 | 201 then 409 FEEDBACK_EXISTS; feedback row count = 1 | PASS | feedback.test.ts :: duplicate feedback |
| TC-LST-12 | 2.0 Intake | Filtering, pagination and per-status counts are computed on the server, not by filtering an in-memory array in the browser | GET /api/v1/requests?status=SUBMITTED&page=2&pageSize=10 with the administrator's cookie against 45 seeded requests | HTTP 200; `items.length` = 10; `page` = 2; `total` equals the true SUBMITTED count; `counts` contains all five statuses plus the total; the ten ids are disjoint from those returned for page 1 | 200; items 10; page 2; total 14; counts {SUBMITTED:14, ASSIGNED:9, IN_PROGRESS:6, COMPLETED:13, CANCELLED:3}; no id overlap with page 1 | PASS | list.test.ts :: pagination page 2 |

───────────────────────────────────────────────────────────────
Table 6.2 — Manual / user-interface test cases (write this second table;
it covers what Supertest cannot see and it costs you 30 minutes)
───────────────────────────────────────────────────────────────
Same six columns, no Ref column. Ten rows, all verifiable by clicking:

| TC-UI-13 | Wizard step validation | Click Next on step 1 of the submit-request wizard with no request type selected | Navigation is blocked and an inline message appears under the field; the step indicator does not advance | ... | PASS |
| TC-UI-14 | Cross-field validator | Type `Test@1234` and `Test@12345` into the registration password and confirm fields and blur | Inline error "Passwords do not match" appears; the Register button remains disabled | ... | PASS |
| TC-UI-15 | Role-filtered navigation | Log in as VICTIM, VOLUNTEER and ADMIN in turn and compare the sidebar | Three different menu sets render; no administrative link is visible to a victim | ... | PASS |
| TC-UI-16 | Route guard | While logged in as a victim, type /admin/user-management into the address bar | The router redirects to a Forbidden page; no admin UI renders even momentarily | ... | PASS |
| TC-UI-17 | Session restore | Log in, then press F5 on /victim/my-requests | The user remains logged in on the same screen; no bounce to the login page | ... | PASS |
| TC-UI-18 | Notification poll | With a victim's browser idle on the dashboard, have a volunteer claim her request in another browser | The bell badge increments within 15 seconds with no manual refresh, and the item deep-links to /requests/:id | ... | PASS |
| TC-UI-19 | Guest guard | While logged in, navigate to /auth/login | Redirected to the role's landing dashboard rather than shown the login form | ... | PASS |
| TC-UI-20 | Derived event status | Inspect the disaster events list against the seeded dates | Each row shows ACTIVE, UPCOMING or PAST consistent with its own start and end dates; no row contradicts its dates | ... | PASS |
| TC-UI-21 | Report export | Open Reports > Help Request Summary, set the range to the last 7 days, click Download CSV | A .csv file downloads via Content-Disposition and opens in Excel with a header row and the same figures shown on screen | ... | PASS |
| TC-UI-22 | Self-deactivation guard | As the administrator, attempt to deactivate your own account | The action is refused with a reason; the account remains ACTIVE | ... | PASS |

───────────────────────────────────────────────────────────────
SECTION 6.6 — EXECUTION SUMMARY (put this immediately after Table 6.2)
───────────────────────────────────────────────────────────────
| Category | Designed | Executed | Passed | Failed | Pass % |
| Integration (automated) | 12 | 12 | 12 | 0 | 100 |
| User interface (manual) | 10 | 10 | 10 | 0 | 100 |
| Total | 22 | 22 | 22 | 0 | 100 |
Follow with Fig 6.1 = a screenshot of the real green `npm test` terminal output.

ONE WARNING ABOUT THIS CHAPTER: if a test genuinely fails during your final run, put
it in the table as FAIL, then add a row to Section 6.7 describing the fix and a
re-test row showing PASS. A table with one honest failure and a documented fix scores
better than twenty-two suspiciously perfect rows.

---

## Screenshots to capture

- docs/screenshots/01-login-empty.png — Login screen, clean state. Caption should note it is a ReactiveFormsModule form with the Google SSO button and Forgot Password link removed as unimplementable. CAPTURE: week 1.
- docs/screenshots/02-login-invalid-credentials.png — Login after submitting a wrong password: inline red error reading exactly 'Invalid email or password', no navigation. Evidence for TC-AUTH-02 and for the no-user-enumeration claim. CAPTURE: week 1.
- docs/screenshots/03-registration-validation-error.png — Registration form with the confirm-password field mismatched, cross-field validator message visible and the submit button disabled. Evidence for TC-UI-14. CAPTURE: week 1.
- docs/screenshots/04-registration-success-adminer.png — Adminer showing the newly created users row with role, status ACTIVE, a 60-character bcrypt hash in password_hash and terms_accepted_at populated. Proves registration writes real data and stores no plaintext. CAPTURE: week 1.
- docs/screenshots/05-victim-dashboard.png — Victim dashboard in disaster-relief vocabulary: active event card 'Kerala Floods 2025 / SEVERE / ACTIVE in Ernakulam' with helpline, open-request count, nearest open shelter card showing 'Govt. HSS Aluva - 2.4 km - 180/300', and the large red SOS button. THE most important victim screenshot. CAPTURE: week 3.
- docs/screenshots/06-submit-wizard-step1-blocked.png — Step 1 of the submit-request wizard with Next pressed and nothing selected: inline validation message, step indicator still on 1. Evidence for TC-UI-13. CAPTURE: week 2.
- docs/screenshots/07-submit-wizard-step2-filled.png — Step 2 with the Kerala district select open showing the 14 seeded districts, landmark text and people count filled. Shows location is a controlled list, not free text or browser GPS. CAPTURE: week 2.
- docs/screenshots/08-submit-wizard-step3-review.png — Step 3 review/confirm panel before submission. CAPTURE: week 2.
- docs/screenshots/09-request-detail-submitted.png — /requests/:id immediately after submission: reference REQ-2026-000046, status pill SUBMITTED, single-row timeline. Caption notes this screen replaced eight dead 'View Details' buttons. CAPTURE: week 2.
- docs/screenshots/10-my-requests-filtered.png — Victim My Requests with the status filter pills and the per-status counts visible, page 1 of a paginated list. Caption must say the counts arrive in the server response envelope, not from filtering an array in the browser. CAPTURE: week 2.
- docs/screenshots/11-volunteer-dashboard.png — Volunteer dashboard with all four KPIs populated from the aggregate endpoint (Available Nearby, My Assigned Tasks, Completed This Month, Hours Contributed). CAPTURE: week 3.
- docs/screenshots/12-available-requests-pool.png — Available request pool sorted by urgency, each card showing a real computed distance in km, with the victim contact area explicitly reading 'contact released on acceptance'. The progressive-PII screenshot. CAPTURE: week 2.
- docs/screenshots/13-claim-conflict-409.png — The losing volunteer's browser showing the toast 'Already accepted by Arun K.' with the card removed from the list and no navigation. Evidence for the claim race at the UI layer. CAPTURE: week 2, staged with two browsers.
- docs/screenshots/14-race-test-terminal.png — Terminal output of scripts/race-test.mjs printing '1 x 201 ACCEPTED, 9 x 409 ALREADY_CLAIMED'. Pair it with Fig 7.15 in the caption. CAPTURE: week 4.
- docs/screenshots/15-adminer-assignments-unique.png — Adminer on the assignments table with the active_help_request_id column and uq_one_active_assignment index visible, showing several historical rows with NULL and exactly one live row with a value. THE single most important figure in the report after the ER diagram. CAPTURE: week 4.
- docs/screenshots/16-my-tasks-status-dialog.png — Volunteer my-tasks status dialog open, progress slider at 50%, showing the legal next states only. CAPTURE: week 3.
- docs/screenshots/17-illegal-transition-400.png — The error shown when ASSIGNED -> COMPLETED is attempted directly, with the server message naming the allowed transitions. Evidence for TC-TRN-10. CAPTURE: week 3.
- docs/screenshots/18-task-completion-hours.png — Completion form requiring hours_logged and a completion note, the only live write path feeding the Hours Contributed KPI. CAPTURE: week 3.
- docs/screenshots/19-request-detail-timeline-full.png — /requests/:id after completion, showing the full timeline SUBMITTED / ASSIGNED / IN_PROGRESS / COMPLETED with timestamps and actor names read from request_status_events, and the assigned volunteer's name and phone now visible to the victim. CAPTURE: week 3.
- docs/screenshots/20-notification-bell-open.png — Header bell dropdown with a real unread count badge and the newest item 'A volunteer has been assigned to your request' at the top, deep-linking to the request. Caption notes 15-second polling paused on document.hidden, with the manual Refresh control visible. CAPTURE: week 3.
- docs/screenshots/21-feedback-form.png — /victim/feedback/:requestId with the 5-star control, comment box and contact-permission checkbox. CAPTURE: week 3.
- docs/screenshots/22-feedback-duplicate-409.png — The 409 'Feedback already submitted' response on a second submission. Evidence for TC-FBK-11, and the visual proof that a UNIQUE index is doing the work. CAPTURE: week 3.
- docs/screenshots/23-forbidden-page.png — The Forbidden page reached by a logged-in victim typing /admin/user-management into the address bar. Evidence for TC-UI-16. CAPTURE: week 1 (as soon as guards exist).
- docs/screenshots/24-curl-403-terminal.png — Terminal showing curl against an admin API endpoint with a victim's session cookie returning 403 JSON. This is the screenshot that proves guards are UX and the server is enforcement. CAPTURE: week 4.
- docs/screenshots/25-sidebar-three-roles.png — A single composite image of the sidebar as rendered for VICTIM, VOLUNTEER and ADMIN side by side. One figure that documents the whole role model. Build it in any image editor from three crops. CAPTURE: week 1.
- docs/screenshots/26-admin-dashboard.png — Admin dashboard with the four real COUNT-derived KPIs, the 7-day trend bars, and the Recent System Activity feed showing real actors and timestamps from request_status_events. Caption must note the System Status panel was removed because it hardcoded a service health that was never measured. CAPTURE: week 3.
- docs/screenshots/27-admin-all-requests-filtered.png — Admin all-requests with status and type filters applied and pagination controls visible, showing the Assigned To column populated. CAPTURE: week 3.
- docs/screenshots/28-admin-assign-dialog.png — The admin Assign dialog listing only APPROVED volunteers. Caption notes it routes through the same claim service as the volunteer self-claim, with assigned_by_user_id set. CAPTURE: week 3.
- docs/screenshots/29-admin-user-management-search.png — User management with a debounced server-side search for 'arun' applied and the volunteer approval queue showing one PENDING row with its Approve action. CAPTURE: week 3.
- docs/screenshots/30-admin-self-deactivate-blocked.png — The refusal message when the administrator attempts to deactivate their own account. Evidence for TC-UI-22 and for the integrity-guard paragraph. CAPTURE: week 3.
- docs/screenshots/31-disaster-events-derived-status.png — Disaster events list showing ACTIVE / UPCOMING / PAST derived live from start and end dates. Caption: status is computed in SQL and never stored, which is why no row can contradict its own dates. CAPTURE: week 3.
- docs/screenshots/32-disaster-event-create-modal.png — The Create New Event modal with centre latitude/longitude, radius_km and helpline number. CAPTURE: week 3.
- docs/screenshots/33-report-summary-onscreen.png — Help Request Summary with a bound date range and the counts-by-type-by-status cross-tab on screen. CAPTURE: week 3.
- docs/screenshots/34-report-csv-in-excel.png — The downloaded CSV open in Excel showing the same figures. Two figures, one story; examiners like seeing the artifact leave the system. CAPTURE: week 3.
- docs/screenshots/35-user-profile.png — Profile page rendering real /auth/me data with role, email and join date read-only and name/phone editable. CAPTURE: week 2.
- docs/screenshots/36-adminer-ten-tables.png — Adminer schema view listing all ten tables. Use it as the opening figure of Section 7.6 Database Evidence. CAPTURE: week 1.
- docs/screenshots/37-docker-compose-up.png — Terminal showing 'docker compose up -d' bringing up mysql and adminer with the healthcheck passing. Belongs in Chapter 5 (Implementation), not Chapter 7. CAPTURE: week 1.
- docs/screenshots/38-npm-test-green.png — The full `npm test` run with twelve passing Supertest cases. This is Fig 6.1 in the Testing chapter. CAPTURE: week 4.
- CAPTURE DISCIPLINE (follow this or you will redo all 38): use ONE Chrome profile at 1440x900 with the bookmarks bar hidden, zoom locked at 100%, no extensions, and the same seeded database. Use Windows Win+Shift+S or ShareX with a fixed 1440x900 region. Name files with the final figure order from day one. Crop consistently — either always full window or always content area, never mixed. And take the shot the evening the screen first works, because the seed data that produced that exact state will be destroyed by the next `docker compose down -v`.

---

## Free diagramming tools

- diagrams.net (draw.io) DESKTOP app — https://github.com/jgraph/drawio-desktop/releases. Free, offline, no account, saves .drawio files you can version in git. THE primary tool: use it for all four DFDs (enable File > Shapes > 'Gane & Sarson' for the correct process/store/entity glyphs), the architecture diagram, the module hierarchy and the final crow's-foot ER diagram (Shape Library > 'Entity Relation' has proper crow's-foot line ends under Edit Style > endArrow=ERmany / ERoneToMany / ERzeroToOne). Export at File > Export as > PNG with Zoom 300% and 'Transparent Background' OFF so it prints on white. Get the DESKTOP build, not the web app — an exam-week internet failure must not cost you your diagrams.
- MySQL Workbench 8.0 (free, Oracle) — Database > Reverse Engineer against the live container produces a correct EER in about two minutes with zero drawing. Use it as the SOURCE OF TRUTH to check your hand-drawn ER diagram against, and keep the exported PNG as backup evidence. Do not submit the Workbench output as your ER figure: it uses IE notation without participation marks, shows every column including audit timestamps, and prints unreadably at A4.
- dbdiagram.io (free tier, browser) — paste the DBML given in the ER plan and it auto-draws a clean crow's-foot diagram in under a minute; drag the boxes into the 4x3 layout and export PNG or PDF. Fastest path if draw.io feels slow, and the DBML is text you can keep in git next to schema.sql. Limitation: it will not draw the callout annotation for the generated column, so add that in any image editor or just put it in the caption.
- Mermaid, via the 'Markdown Preview Mermaid Support' VS Code extension or https://mermaid.live — free, text-based, excellent for the SEQUENCE DIAGRAM of the claim race and the STATE CHART of the request lifecycle (both are ~15 lines of text and look professional immediately). Do NOT use Mermaid's erDiagram for the graded ER figure: its auto-layout cannot be controlled and produces crossing lines on ten entities.
- PlantUML, via the VS Code 'PlantUML' extension with the free public render server or a local jar — the cheapest way to produce the use case diagram (3 actors, ~18 use cases with <<include>>), the activity diagram for the request lifecycle and a component diagram. Fifteen lines of text per diagram, and they all restyle consistently when you change one skinparam. Export SVG for crisp print.
- ShareX (free, open source, Windows) or the built-in Win+Shift+S — ShareX is worth the ten-minute setup because you can pin a FIXED 1440x900 capture region and auto-name files with a counter, which is exactly what keeps 38 screenshots visually consistent. Set the save folder to docs/screenshots/ and never crop by hand.
- IrfanView or Paint.NET (both free, Windows) — for the one composite image you need (the three-role sidebar comparison) and for batch-resizing screenshots to a uniform width before they go into Word. Batch resize in IrfanView: File > Batch Conversion, set width 1400, keep aspect ratio.
- LibreOffice Draw (free) — fallback only, if your college machine forbids installing draw.io. It can do the diagrams but the shape libraries are poorer and the crow's-foot ends must be hand-built.
- Zotero (free) with the browser connector — for Chapter 9. Click the connector on each MySQL manual page, NDMA page or paper as you read it in week 1-2, then export the whole bibliography in IEEE style at the end in one click. Saves an hour in week 4 and guarantees you do not cite something you never opened.
- WHAT NOT TO USE: Lucidchart and Creately (free tiers cap you at 3 documents / add watermarks — you need at least 10 diagrams); Visio (paid); Canva (no ER or DFD semantics, and it tempts you into decorating instead of documenting); any AI diagram generator (it will invent relationships that are not in your schema and an examiner who checks the diagram against Adminer will find them).
