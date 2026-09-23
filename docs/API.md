# API Contract

REST under `/api/v1`. 28 endpoints.

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/health` | public | Liveness + DB ping. Public allowlist entry; used by the demo pre-flight and by the report's deployment chapter. |
| `POST` | `/api/v1/auth/register` | public | Self-registration as VICTIM or VOLUNTEER. Creates users row (+ volunteer_profiles row with approval_status PENDING when role=VOLUNTEER), writes terms_accepted_at, logs the user straight in. |
| `POST` | `/api/v1/auth/login` | public | Email + password authentication. Issues the session cookie, bumps last_login_at. |
| `POST` | `/api/v1/auth/logout` | any authed | Clears the session cookie and increments users.token_version so every outstanding JWT for that user dies immediately. |
| `GET` | `/api/v1/auth/me` | any authed | Session restore on every page load, and the single source of the ONE identity rendered in the header, the sidebar user card, the profile page and every 'Welcome, X'. |
| `PATCH` | `/api/v1/auth/me` | any authed (owner by definition) | Edit own first name, last name and phone. Nothing else is writable. |
| `GET` | `/api/v1/reference` | any authed | One call returning every server-driven lookup the UI needs, so no <select> is ever hardcoded again. Cached in a signal by the Angular ReferenceStore for the session. |
| `POST` | `/api/v1/requests` | VICTIM | Create a help request. Serves BOTH the 3-step wizard and the one-tap SOS button (same endpoint, different body). |
| `GET` | `/api/v1/requests` | any authed (scope is role-validated) | THE list endpoint. One resource, four scopes, server-side filtering + sorting + pagination + per-facet counts. Replaces four screens' worth of in-memory array filtering. |
| `GET` | `/api/v1/requests/:id` | owner-scoped (victim submitter | assigned volunteer | ADMIN) | THE REQUEST DETAIL SCREEN that does not exist today, behind eight dead 'View Details' buttons. One endpoint, role-aware projection, includes the status timeline. |
| `POST` | `/api/v1/requests/:id/cancel` | owner-scoped (victim submitter while SUBMITTED) | ADMIN (any non-terminal) | Makes the 'Cancelled' filter pill reachable for the first time, and gives the admin a way to kill a request that already has a live assignment. |
| `POST` | `/api/v1/requests/:id/claim` | VOLUNTEER (approval_status must be APPROVED) | THE ACCEPT BUTTON. The atomic claim: SELECT ... FOR UPDATE, INSERT assignment, UPDATE request, INSERT status event, INSERT notification, COMMIT. |
| `POST` | `/api/v1/requests/:id/assign` | ADMIN | The admin Assign dialog. Routes through the IDENTICAL claim service with assigned_by_user_id set. |
| `PATCH` | `/api/v1/assignments/:id` | owner-scoped (the assigned VOLUNTEER) | ADMIN | The status dialog: advance the assignment lifecycle, write progress, log hours on completion. The only live write path that feeds the 'Hours Contributed' KPI. |
| `POST` | `/api/v1/requests/:id/feedback` | owner-scoped (victim submitter, request COMPLETED) | One rating per completed request. The UNIQUE index - not an if-statement - rejects the second submission. |
| `GET` | `/api/v1/notifications` | any authed (always scoped to recipient_user_id = me.id) | The header bell: unread count for the badge and the dropdown list. Polled every 15s, paused on document.hidden. |
| `POST` | `/api/v1/notifications/:id/read` | owner-scoped (recipient) | Mark one notification read when its row is clicked, before navigating to the deep link. |
| `POST` | `/api/v1/notifications/read-all` | any authed | 'Mark all as read' in the dropdown footer (replaces the dead 'View all notifications' link - there is no notifications page). |
| `GET` | `/api/v1/dashboard/victim` | VICTIM | The rewritten victim dashboard in disaster-relief vocabulary, in ONE round trip: active disaster for your district, your open requests, nearest open shelter, unread count. |
| `GET` | `/api/v1/dashboard/volunteer` | VOLUNTEER | All four volunteer KPIs plus the current-assignments table, in ONE aggregate instead of four round trips. |
| `GET` | `/api/v1/dashboard/admin` | ADMIN | Four KPIs from real COUNT aggregates, the 7-day trend, and the Recent System Activity feed - one endpoint, one screen. |
| `GET` | `/api/v1/users` | ADMIN | The user-management console: debounced server-side search, role/status/approval filters, pagination. Also populates the admin Assign dialog's volunteer picker. |
| `PATCH` | `/api/v1/users/:id` | ADMIN | Change a user's role, or activate/deactivate them. The two guardrails are viva paragraphs. |
| `POST` | `/api/v1/users/:id/volunteer-approval` | ADMIN | The volunteer approval gate: approve or reject a PENDING volunteer. |
| `GET` | `/api/v1/disaster-events` | any authed | The admin events table, with ACTIVE/UPCOMING/PAST derived in SQL from the dates and never stored. |
| `POST` | `/api/v1/disaster-events` | ADMIN | The 'Create New Event' modal - the large primary button an examiner reaches for, and the thing that makes auto-attach-by-radius demoable live. |
| `GET` | `/api/v1/shelters` | any authed | The seeded, read-only shelter directory: a plain admin table, and (via nearLat/nearLng) the 'nearest open shelter' lookup. |
| `GET` | `/api/v1/reports/help-request-summary` | ADMIN | The ONE surviving report: counts by request type x status over a bound date range, rendered on screen and downloadable as CSV from the same endpoint. |

---

## Endpoint detail

### `GET /api/v1/health`

- **Auth:** public
- **Purpose:** Liveness + DB ping. Public allowlist entry; used by the demo pre-flight and by the report's deployment chapter.
- **Request:** `none`
- **Response:** `200 { status: 'ok', db: 'ok', time: '2026-09-20T09:00:00.000Z' }`
- **Serves:** (none - operational)
- **Notes:** The admin System Status panel is DELETED, so this endpoint is not rendered anywhere. Keep it anyway: it is 5 lines, it is the thing you curl when the demo misbehaves, and it is the only public GET in the allowlist.

### `POST /api/v1/auth/register`

- **Auth:** public
- **Purpose:** Self-registration as VICTIM or VOLUNTEER. Creates users row (+ volunteer_profiles row with approval_status PENDING when role=VOLUNTEER), writes terms_accepted_at, logs the user straight in.
- **Request:** `body RegisterBody: { firstName, lastName, email, phone?, password, confirmPassword, role: 'VICTIM'|'VOLUNTEER', homeDistrict?, termsAccepted: true }`
- **Response:** `201 SessionUser + Set-Cookie: drms_session. 409 EMAIL_TAKEN / PHONE_TAKEN (from errno 1062, disambiguated by index name). 422 VALIDATION_FAILED with fieldErrors.confirmPassword on mismatch.`
- **Serves:** /auth/register
- **Notes:** role is a Zod enum of exactly ['VICTIM','VOLUNTEER'] - ADMIN is unreachable through the API by construction, not by an if-statement. Sets home_lat/home_lng from the seeded district centroid when homeDistrict is given, which is what makes SOS and the shelter card work for a brand-new account created live in demo step 3. Cross-field match is validated on BOTH sides (Angular validator for the live red text, Zod .refine for the guarantee).

### `POST /api/v1/auth/login`

- **Auth:** public
- **Purpose:** Email + password authentication. Issues the session cookie, bumps last_login_at.
- **Request:** `body LoginBody: { email, password }`
- **Response:** `200 SessionUser + Set-Cookie. 401 INVALID_CREDENTIALS (identical message for unknown email and wrong password - no user enumeration). 403 ACCOUNT_INACTIVE when users.status='INACTIVE'. 429 TOO_MANY_ATTEMPTS.`
- **Serves:** /auth/login
- **Notes:** The ONLY rate-limited route: express-rate-limit, windowMs 15min, max 6, keyGenerator = req.ip + ':' + normalised email, skipSuccessfulRequests: true. bcrypt.compare runs against a dummy hash when the email is unknown so the timing does not leak existence. Demo step 2 types " OR '1'='1 " into the email field: Zod z.string().email() rejects it at 422 before SQL is ever built.

### `POST /api/v1/auth/logout`

- **Auth:** any authed
- **Purpose:** Clears the session cookie and increments users.token_version so every outstanding JWT for that user dies immediately.
- **Request:** `none`
- **Response:** `200 { ok: true } + Set-Cookie: drms_session=; Max-Age=0`
- **Serves:** layout/sidebar (logout icon), layout/header (Sign Out menu item)
- **Notes:** Both the sidebar button and the header menu item call the same AuthStore.logout(), which awaits this then router.navigateByUrl('/auth/login'). Today sidebar.logout() is console.log only and header 'Sign Out' is href='#'.

### `GET /api/v1/auth/me`

- **Auth:** any authed
- **Purpose:** Session restore on every page load, and the single source of the ONE identity rendered in the header, the sidebar user card, the profile page and every 'Welcome, X'.
- **Request:** `none`
- **Response:** `200 SessionUser: { id, email, firstName, lastName, fullName, phone, role, status, homeDistrict, homeLat, homeLng, createdAt, initials, volunteer?: { approvalStatus, organisation, serviceRadiusKm, ratingAvg, ratingCount, completedCount, hoursLogged } }. 401 UNAUTHENTICATED.`
- **Serves:** all (provideAppInitializer), /profile, layout/header, layout/sidebar, /victim/dashboard, /volunteer/dashboard
- **Notes:** WITHOUT this + provideAppInitializer, every F5 during the viva bounces a logged-in examiner to the login page. The 401 here is the ONE 401 the error interceptor must swallow silently instead of redirecting (it is the bootstrap probe). `initials` is computed server-side (first_name[0]+last_name[0]) and is what replaces every placehold.co avatar with a CSS circle.

### `PATCH /api/v1/auth/me`

- **Auth:** any authed (owner by definition)
- **Purpose:** Edit own first name, last name and phone. Nothing else is writable.
- **Request:** `body UpdateMeBody: { firstName?, lastName?, phone? | null }`
- **Response:** `200 SessionUser. 409 PHONE_TAKEN. 422 VALIDATION_FAILED.`
- **Serves:** /profile
- **Notes:** role, email, status, homeDistrict and createdAt are NOT in the Zod schema, so a crafted body cannot self-promote to ADMIN - the mass-assignment hole is closed by the schema, not by a service check. The Change Password card and POST /users/me/password from the survey are CUT; delete the card rather than leaving three unbound inputs.

### `GET /api/v1/reference`

- **Auth:** any authed
- **Purpose:** One call returning every server-driven lookup the UI needs, so no <select> is ever hardcoded again. Cached in a signal by the Angular ReferenceStore for the session.
- **Request:** `none`
- **Response:** `200 { requestTypes: [{ id, code, label, iconKey, colorKey, sortOrder }], districts: [{ code: 'ERNAKULAM', label: 'Ernakulam', lat, lng }] (14), urgencies: ['LOW','MEDIUM','HIGH','CRITICAL'], requestStatuses: ['SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'] }`
- **Serves:** /victim/submit-request, /victim/my-requests, /volunteer/available-tasks, /admin/all-requests, /admin/disaster-management, /auth/register
- **Notes:** Collapses four separate lookup endpoints into one round trip. requestTypes comes from the request_types TABLE (admin-extensible); districts comes from backend/src/reference/kerala-districts.ts (an ENUM + a code array, deliberately NOT an 11th table - prepared viva answer). iconKey/colorKey are mapped to FontAwesome IconDefinitions and Tailwind classes by ONE client-side map, which is what finally gets icon:any and iconBgColor:'bg-red-500' off the data model. Fixes the 'Rescue / Evacuation' option missing from the admin filter, by construction.

### `POST /api/v1/requests`

- **Auth:** VICTIM
- **Purpose:** Create a help request. Serves BOTH the 3-step wizard and the one-tap SOS button (same endpoint, different body).
- **Request:** `body CreateRequestBody: { typeCode: 'MEDICAL'|'FOOD_WATER'|'SHELTER'|'RESCUE'|'OTHER', urgency, district, locationText (3..200), peopleCount (>=1, <=500), description (>=10, <=2000), contactPhone?, contactEmail? }`
- **Response:** `201 RequestDetail (includes id + reference 'REQ-2026-000046' + the auto-attached disasterEvent). 422 VALIDATION_FAILED.`
- **Serves:** /victim/submit-request, /victim/dashboard (SOS button)
- **Notes:** Server-side, inside ONE transaction: resolve lat/lng (victim's home point if submitter.home_district === body.district, else the district centroid - location_source is set to HOME_POINT or DISTRICT_CENTROID accordingly, which is the honest answer to 'how accurate is that 2.4 km?'); auto-attach disaster_event_id = nearest ACTIVE event whose radius_km contains that point (ST_Distance_Sphere over <=4 rows, ORDER BY distance LIMIT 1); INSERT help_requests; INSERT request_status_events (NULL -> SUBMITTED); INSERT notifications REQUEST_SUBMITTED for every ACTIVE ADMIN. SOS posts { typeCode:'RESCUE', urgency:'CRITICAL', district: me.homeDistrict, locationText:'SOS - saved home location', peopleCount:1, description:'Emergency SOS raised from the victim dashboard.' } after a confirm dialog, then routes to /requests/:id. source is hardcoded 'WEB' server-side and is NOT accepted from the client.

### `GET /api/v1/requests`

- **Auth:** any authed (scope is role-validated)
- **Purpose:** THE list endpoint. One resource, four scopes, server-side filtering + sorting + pagination + per-facet counts. Replaces four screens' worth of in-memory array filtering.
- **Request:** `query ListRequestsQuery: { scope: 'mine'|'available'|'assigned'|'all', page=1, pageSize (scope default: mine 5, available 9, assigned 9, all 10; max 50), status?, typeCode?, district?, urgency?, q? (scope=all only), from?, to? (scope=all only), sort? ('urgency'|'distance'|'newest', scope=available only, default 'urgency') }`
- **Response:** `200 ListEnvelope<RequestListItem>: { items, page, pageSize, total, counts }`
- **Serves:** /victim/my-requests (scope=mine), /volunteer/available-tasks (scope=available), /volunteer/my-tasks (scope=assigned), /admin/all-requests (scope=all), /volunteer/dashboard (scope=assigned&pageSize=5)
- **Notes:** Scope authorization: mine -> any role, hard-filtered to submitted_by_user_id = me.id (a VICTIM cannot request any other scope); available -> VOLUNTEER|ADMIN, WHERE status='SUBMITTED' AND no active assignment; assigned -> VOLUNTEER, JOIN assignments ON active_help_request_id (plus recently COMPLETED); all -> ADMIN only. counts keys are scope-dependent and always include 'ALL': mine/all -> the five request statuses (this is what lights up the filter pills and makes 'Page 1 of N' correct per filter); available -> the four urgencies; assigned -> the assignment statuses. All seven counts + the total come back from ONE query using SUM(CASE WHEN status='X' THEN 1 ELSE 0 END) - MySQL has no FILTER (WHERE ...), and here the dialect difference is an advantage. scope=available computes distanceKm via ST_Distance_Sphere(POINT(lng,lat), POINT(?,?))/1000 from the volunteer's home point (SRID 0, longitude-first - never 4326) and sort=urgency maps to `ORDER BY urgency DESC, submitted_at ASC` with no CASE, because the ENUM is declared in severity order. scope=all q does anchored LIKE CONCAT(?,'%') on last_name / email UNION an exact match on the numeric part of a pasted REQ-2026-000046 reference - no leading wildcard, no pg_trgm.

### `GET /api/v1/requests/:id`

- **Auth:** owner-scoped (victim submitter | assigned volunteer | ADMIN)
- **Purpose:** THE REQUEST DETAIL SCREEN that does not exist today, behind eight dead 'View Details' buttons. One endpoint, role-aware projection, includes the status timeline.
- **Request:** `path id (positive int)`
- **Response:** `200 RequestDetail: { id, reference, type, urgency, status, district, locationText, lat, lng, locationSource, peopleCount, description, submittedAt, firstAssignedAt, completedAt, cancelledAt, cancelReason, disasterEvent: {id,name,type,severity,helplineNumber}|null, submittedBy: {id, fullName, initials, phone?, email?}|null, assignment: {id, status, progressPct, hoursLogged, completionNotes, claimedAt, startedAt, completedAt, volunteer:{id, fullName, initials, phone?, organisation, ratingAvg}}|null, timeline: [{id, fromStatus, toStatus, note, occurredAt, actor:{id, fullName, role}|null}], feedback: {rating, comments, createdAt}|null, permissions: { canCancel, canClaim, canUpdateAssignment, canGiveFeedback, canAssign } }. 403 FORBIDDEN. 404 NOT_FOUND.`
- **Serves:** /requests/:id, /victim/my-requests (View Details), /volunteer/available-tasks (View Details), /volunteer/my-tasks (View Details), /admin/all-requests (View), /victim/dashboard (notification deep link), /victim/feedback/:requestId (header block)
- **Notes:** THE PII GATE LIVES IN ONE SERIALIZER, not in the component. VICTIM (owner): sees everything of their own + the assigned volunteer's name and phone. VOLUNTEER before claiming: type, urgency, district, locationText, peopleCount, description, distance - submittedBy is null, no phone, no email. VOLUNTEER after their claim succeeds: submittedBy.fullName/phone/email appear in the SAME payload shape. ADMIN: everything. This is the 'progressive PII disclosure' viva point and it is enforced in serializers/request.serializer.ts, which is the only file that can leak. The `permissions` block is not decoration - it is what lets ONE component render three roles without three *ngIf ladders, and it saves hours. 403 (not 404) on victim B's id is deliberate and is what demo step 8 curls.

### `POST /api/v1/requests/:id/cancel`

- **Auth:** owner-scoped (victim submitter while SUBMITTED) | ADMIN (any non-terminal)
- **Purpose:** Makes the 'Cancelled' filter pill reachable for the first time, and gives the admin a way to kill a request that already has a live assignment.
- **Request:** `body { reason?: string (<=255) }`
- **Response:** `200 RequestDetail. 409 ILLEGAL_TRANSITION when already COMPLETED/CANCELLED. 403 FORBIDDEN.`
- **Serves:** /victim/my-requests, /requests/:id, /admin/all-requests
- **Notes:** Victim path: allowed ONLY while status='SUBMITTED' (no active assignment exists, nothing to release). Admin path on an assigned request runs one transaction: UPDATE assignments SET status='RELEASED', released_at=UTC_TIMESTAMP(3) WHERE active_help_request_id=? (the generated column goes NULL, so the unique slot frees itself the instant it commits); UPDATE help_requests SET status='CANCELLED', cancelled_at, cancel_reason; INSERT status event; INSERT notifications for both the victim and the released volunteer.

### `POST /api/v1/requests/:id/claim`

- **Auth:** VOLUNTEER (approval_status must be APPROVED)
- **Purpose:** THE ACCEPT BUTTON. The atomic claim: SELECT ... FOR UPDATE, INSERT assignment, UPDATE request, INSERT status event, INSERT notification, COMMIT.
- **Request:** `no body`
- **Response:** `201 RequestDetail (now WITH the victim's name and phone, so the UI reveals contact in the same round trip). 409 ALREADY_CLAIMED { message: 'Already accepted by Arun K.', helpRequestId }. 403 VOLUNTEER_NOT_APPROVED. 404 NOT_FOUND.`
- **Serves:** /volunteer/available-tasks (Accept), /requests/:id (Accept)
- **Notes:** Two independent layers produce the SAME 409: the row lock (which wins the race in practice and lets alreadyClaimed() name the winner via a unique-index lookup on active_help_request_id) and uq_one_active_assignment (errno 1062, matched on the index-name substring 'uq_one_active_assignment' because 8.0 prefixes it with the table name). SET SESSION innodb_lock_wait_timeout = 5 on this connection so errno 1205 fails fast into a 409 instead of a 50-second spinner in front of the examiner; errno 1213 deadlock is retried exactly once. The approval check is server-side: an unapproved volunteer may browse the pool (scope=available works) and receives 403 with an explanatory banner only on claim.

### `POST /api/v1/requests/:id/assign`

- **Auth:** ADMIN
- **Purpose:** The admin Assign dialog. Routes through the IDENTICAL claim service with assigned_by_user_id set.
- **Request:** `body { volunteerUserId: number }`
- **Response:** `201 RequestDetail. 409 ALREADY_CLAIMED. 422 VOLUNTEER_NOT_APPROVED / not a VOLUNTEER.`
- **Serves:** /admin/all-requests (Assign)
- **Notes:** claimService.claim({ helpRequestId, volunteerUserId, assignedByUserId, actor }) - one function, two callers. This is why a future refactor cannot create a second code path that bypasses the invariant, and it is the first item on the abort list if week 3 ends behind (volunteers self-claim, so it is redundant to the click-path). The volunteer picker is populated by GET /api/v1/users?role=VOLUNTEER&approvalStatus=APPROVED.

### `PATCH /api/v1/assignments/:id`

- **Auth:** owner-scoped (the assigned VOLUNTEER) | ADMIN
- **Purpose:** The status dialog: advance the assignment lifecycle, write progress, log hours on completion. The only live write path that feeds the 'Hours Contributed' KPI.
- **Request:** `body UpdateAssignmentBody: { status?: 'IN_PROGRESS'|'AWAITING_CONFIRMATION'|'COMPLETED', progressPct?: 0..100, hoursLogged?: 0..24 (step .25), note?: string(<=500) }`
- **Response:** `200 RequestDetail. 400 ILLEGAL_TRANSITION { from, to, allowed: [...] }. 422 HOURS_REQUIRED when status=COMPLETED and hoursLogged is absent. 403 FORBIDDEN.`
- **Serves:** /volunteer/my-tasks (Update Status), /requests/:id
- **Notes:** Legal transition table lives in ONE const in assignment.service.ts: ASSIGNED->[IN_PROGRESS, AWAITING_CONFIRMATION]; IN_PROGRESS->[AWAITING_CONFIRMATION, COMPLETED]; AWAITING_CONFIRMATION->[COMPLETED]; COMPLETED->[]; RELEASED->[]. ASSIGNED->COMPLETED is therefore a 400, which is demo step 14 and integration test 10. Each transition is ONE transaction that also: mirrors the request status (IN_PROGRESS -> help_requests.status='IN_PROGRESS'; COMPLETED -> status='COMPLETED' + completed_at, and UPDATE volunteer_profiles SET hours_logged = hours_logged + ?, completed_count = completed_count + 1), appends a request_status_event, and inserts a notification for the victim. DESIGN NOTE (say it out loud in the viva): AWAITING_CONFIRMATION is an ASSIGNMENT sub-state and has no matching request status, so its timeline row is written with from_status = to_status = 'IN_PROGRESS' plus note='Volunteer marked work complete; awaiting confirmation'. The victim sign-off screen is cut; ADMIN closes it out with the same PATCH.

### `POST /api/v1/requests/:id/feedback`

- **Auth:** owner-scoped (victim submitter, request COMPLETED)
- **Purpose:** One rating per completed request. The UNIQUE index - not an if-statement - rejects the second submission.
- **Request:** `body CreateFeedbackBody: { rating: 1..5, comments?: string(<=2000), contactPermission: boolean }`
- **Response:** `201 { id, rating, comments, contactPermission, createdAt }. 409 FEEDBACK_EXISTS (from errno 1062 on uq_feedback_help_request). 422 REQUEST_NOT_COMPLETED. 403 FORBIDDEN (not the submitter).`
- **Serves:** /victim/feedback/:requestId, /victim/my-requests (Give Feedback), /requests/:id
- **Notes:** One transaction: INSERT feedback (denormalising assignment_id and volunteer_user_id off the active/completed assignment so the rating aggregate is one query); UPDATE volunteer_profiles SET rating_count = rating_count + 1, rating_avg = ((rating_avg * rating_count) + ?) / (rating_count + 1); INSERT notification FEEDBACK_RECEIVED for the volunteer. The screen reads the request header block ('REQ-2026-000046 - Medical Assistance') from GET /requests/:id, so there is no extra endpoint - and the route finally takes a parameter, wired with withComponentInputBinding. Demo step 15 submits twice.

### `GET /api/v1/notifications`

- **Auth:** any authed (always scoped to recipient_user_id = me.id)
- **Purpose:** The header bell: unread count for the badge and the dropdown list. Polled every 15s, paused on document.hidden.
- **Request:** `query { page=1, pageSize=10 (max 50), unreadOnly?: boolean }`
- **Response:** `200 ListEnvelope<Notification>: items: [{ id, type, title, body, helpRequestId, readAt, createdAt }], counts: { ALL: n, UNREAD: n }`
- **Serves:** layout/header (bell + dropdown)
- **Notes:** ONE index (recipient_user_id, read_at, created_at DESC) serves both the count and the list. counts.UNREAD replaces the permanently-lit red dot. Rows deep-link to /requests/:id derived from helpRequestId - there is no target_url column and no polymorphic entity_type/entity_id pair. The 15s poll is accompanied by a VISIBLE manual Refresh control beside a 'Live' label: the button, not a faster timer, is what stops you standing in silence in demo step 13.

### `POST /api/v1/notifications/:id/read`

- **Auth:** owner-scoped (recipient)
- **Purpose:** Mark one notification read when its row is clicked, before navigating to the deep link.
- **Request:** `no body`
- **Response:** `200 { id, readAt, unreadCount }`
- **Serves:** layout/header
- **Notes:** Returns the new unreadCount so the badge updates without waiting for the next poll tick. UPDATE ... WHERE id=? AND recipient_user_id=? - ownership is in the WHERE clause, so a forged id affects 0 rows and returns 404.

### `POST /api/v1/notifications/read-all`

- **Auth:** any authed
- **Purpose:** 'Mark all as read' in the dropdown footer (replaces the dead 'View all notifications' link - there is no notifications page).
- **Request:** `no body`
- **Response:** `200 { updated: n, unreadCount: 0 }`
- **Serves:** layout/header
- **Notes:** A full notifications page is NOT built; the dropdown is the whole feature. Delete the 'View all notifications' href='#' rather than leaving it dead.

### `GET /api/v1/dashboard/victim`

- **Auth:** VICTIM
- **Purpose:** The rewritten victim dashboard in disaster-relief vocabulary, in ONE round trip: active disaster for your district, your open requests, nearest open shelter, unread count.
- **Request:** `none`
- **Response:** `200 { firstName, activeEvent: {id, name, type, severity, district, helplineNumber, startDate}|null, openRequestCount, totalRequestCount, latestRequest: RequestListItem|null, nearestShelter: {id, name, district, addressText, distanceKm, capacity, currentOccupancy, status, contactPhone}|null, unreadNotificationCount }`
- **Serves:** /victim/dashboard
- **Notes:** activeEvent = the ACTIVE event (status derived in SQL from start_date/end_date, never stored) whose radius contains the victim's home point, nearest first. nearestShelter = WHERE status='OPEN' ORDER BY ST_Distance_Sphere(...) LIMIT 1 from the home point - renders 'Govt. HSS Aluva - 2.4 km - 180/300'. The SOS button posts to POST /api/v1/requests. 'Find Support', support-group events, RSVP and the three Safety Resources articles are CUT - delete the cards, do not leave href='#'.

### `GET /api/v1/dashboard/volunteer`

- **Auth:** VOLUNTEER
- **Purpose:** All four volunteer KPIs plus the current-assignments table, in ONE aggregate instead of four round trips.
- **Request:** `none`
- **Response:** `200 { firstName, approvalStatus, kpis: { availableNearby, myAssignedTasks, completedThisMonth, hoursContributed }, currentAssignments: RequestListItem[] (<=5) }`
- **Serves:** /volunteer/dashboard
- **Notes:** availableNearby = COUNT of SUBMITTED requests with no active assignment within volunteer_profiles.service_radius_km of the home point. completedThisMonth = COUNT(assignments WHERE volunteer=me AND status='COMPLETED' AND completed_at >= first of month). hoursContributed = volunteer_profiles.hours_logged (seeded history + every live PATCH /assignments/:id completion). Zero writes happen on this screen; the live write path is demoed on my-tasks. When approvalStatus !== 'APPROVED' the page renders the explanatory banner instead of the CTA.

### `GET /api/v1/dashboard/admin`

- **Auth:** ADMIN
- **Purpose:** Four KPIs from real COUNT aggregates, the 7-day trend, and the Recent System Activity feed - one endpoint, one screen.
- **Request:** `query { activityLimit=8 }`
- **Response:** `200 { kpis: { totalUsers, activeRequests, approvedVolunteers, resolvedToday }, trend: [{ date: '2026-09-14', count: 6 } x7], recentActivity: [{ id, helpRequestId, reference, fromStatus, toStatus, note, occurredAt, actor: {id, fullName, role}|null }] }`
- **Serves:** /dashboard (admin)
- **Notes:** 'Volunteers Online / Live count' is RENAMED to 'Approved Volunteers' - there is no presence tracking and a fake live count is a question you cannot answer. trend is one `GROUP BY DATE(submitted_at)` over the last 7 days, left-joined against a generated 7-day array in the service so empty days render a zero-height bar; the client draws seven divs with [style.height.%]. No Chart.js. recentActivity is request_status_events JOIN users ORDER BY occurred_at DESC - the same table that feeds the /requests/:id timeline, which is why audit_logs was cut. Every row routerLinks to /requests/:id (today they are all href='#'). The hardcoded trend strings (+1.5% this week etc.), the System Status panel, 'Create New Report' and 'Export Data' are DELETED.

### `GET /api/v1/users`

- **Auth:** ADMIN
- **Purpose:** The user-management console: debounced server-side search, role/status/approval filters, pagination. Also populates the admin Assign dialog's volunteer picker.
- **Request:** `query ListUsersQuery: { page=1, pageSize=10 (max 50), q?, role?, status?, approvalStatus? }`
- **Response:** `200 ListEnvelope<UserListItem>: items: [{ id, fullName, initials, email, phone, role, status, homeDistrict, createdAt, volunteer?: { approvalStatus, ratingAvg, completedCount } }], counts: { ALL, ADMIN, VOLUNTEER, VICTIM, PENDING_VOLUNTEERS }`
- **Serves:** /admin/user-management, /admin/all-requests (Assign dialog picker, with role=VOLUNTEER&approvalStatus=APPROVED)
- **Notes:** q is anchored LIKE CONCAT(?,'%') against ix_users_name (last_name, first_name) UNION an anchored match on email - a leading wildcard would defeat the B-tree and MySQL has no pg_trgm. Debounced 300ms client-side. counts.PENDING_VOLUNTEERS is what makes the approval queue findable in demo step 9 without a separate screen.

### `PATCH /api/v1/users/:id`

- **Auth:** ADMIN
- **Purpose:** Change a user's role, or activate/deactivate them. The two guardrails are viva paragraphs.
- **Request:** `body AdminUpdateUserBody: { role?: 'ADMIN'|'VOLUNTEER'|'VICTIM', status?: 'ACTIVE'|'INACTIVE' }`
- **Response:** `200 UserListItem. 422 CANNOT_DEACTIVATE_SELF. 422 LAST_ADMIN. 404 NOT_FOUND.`
- **Serves:** /admin/user-management
- **Notes:** Guardrails enforced in the service, inside the transaction: (1) id === me.id && status==='INACTIVE' -> 422 CANNOT_DEACTIVATE_SELF; (2) demoting or deactivating the last ACTIVE ADMIN -> 422 LAST_ADMIN, checked with SELECT COUNT(*) ... FOR UPDATE so two concurrent admins cannot both slip through. Deactivating also bumps token_version, which kills that user's live session on their next request. There is NO DELETE endpoint: fk_as_volunteer and fk_hr_submitter are ON DELETE RESTRICT, so 'users holding history are deactivated, never deleted' is a database fact. DELETE the 'Add New User' button and the trash icon from the template - an admin-created user has no password and no email transport to set one.

### `POST /api/v1/users/:id/volunteer-approval`

- **Auth:** ADMIN
- **Purpose:** The volunteer approval gate: approve or reject a PENDING volunteer.
- **Request:** `body { decision: 'APPROVED'|'REJECTED', reason?: string(<=255) }`
- **Response:** `200 UserListItem (with volunteer.approvalStatus updated). 404 NOT_A_VOLUNTEER.`
- **Serves:** /admin/user-management (Approve button)
- **Notes:** Separate from PATCH /users/:id because it writes volunteer_profiles (approval_status, approved_by_user_id, approved_at, rejection_reason) AND inserts a VOLUNTEER_APPROVED notification in the same transaction - the approved volunteer's bell lights up. Seed every demo-path volunteer as APPROVED and exactly one spare as PENDING so the demo cannot stall here.

### `GET /api/v1/disaster-events`

- **Auth:** any authed
- **Purpose:** The admin events table, with ACTIVE/UPCOMING/PAST derived in SQL from the dates and never stored.
- **Request:** `query { status?: 'ACTIVE'|'UPCOMING'|'PAST', page=1, pageSize=10 }`
- **Response:** `200 ListEnvelope<DisasterEvent>: items: [{ id, name, type, severity, district, locationText, centerLat, centerLng, radiusKm, helplineNumber, description, startDate, endDate, status (derived), openRequestCount }], counts: { ALL, ACTIVE, UPCOMING, PAST }`
- **Serves:** /admin/disaster-management
- **Notes:** status is `CASE WHEN start_date > NOW() THEN 'UPCOMING' WHEN end_date IS NOT NULL AND end_date < NOW() THEN 'PAST' ELSE 'ACTIVE' END` in the SELECT. The shipped mock data contradicted itself (a past-dated event labelled 'Upcoming') precisely because status was stored - that before/after is a report paragraph. endDate null renders 'Ongoing'. Row-level Edit and View Details icon buttons are DELETED, not stubbed.

### `POST /api/v1/disaster-events`

- **Auth:** ADMIN
- **Purpose:** The 'Create New Event' modal - the large primary button an examiner reaches for, and the thing that makes auto-attach-by-radius demoable live.
- **Request:** `body CreateEventBody: { name, type, severity, district?, locationText, centerLat, centerLng, radiusKm (1..500), helplineNumber?, description?, startDate, endDate? }`
- **Response:** `201 DisasterEvent (with derived status). 422 VALIDATION_FAILED (endDate must be > startDate).`
- **Serves:** /admin/disaster-management
- **Notes:** centerLat/centerLng are prefilled from the selected district's seeded centroid, so the admin picks a district and a radius rather than typing coordinates - no map, no geocoder. Demo step 17 creates 'Cyclone Ditwah 2026' at Ernakulam radius 40 km, then a new request from Priya's window auto-attaches to it. Update/delete are NOT built.

### `GET /api/v1/shelters`

- **Auth:** any authed
- **Purpose:** The seeded, read-only shelter directory: a plain admin table, and (via nearLat/nearLng) the 'nearest open shelter' lookup.
- **Request:** `query { district?, status?, nearLat?, nearLng?, limit=20 }`
- **Response:** `200 ListEnvelope<Shelter>: items: [{ id, name, district, addressText, lat, lng, capacity, currentOccupancy, status, contactPhone, disasterEventId, distanceKm?: number|null }], counts: { ALL, OPEN, FULL, CLOSED }`
- **Serves:** /admin/disaster-management (shelters table), (victim dashboard reads the nearest shelter from /dashboard/victim instead, to save a round trip on the most-watched screen)
- **Notes:** Read-only by design: no POST, no PATCH, no occupancy editing. 8 seeded rows. When nearLat/nearLng are supplied the rows carry a real ST_Distance_Sphere kilometre figure and are ordered by it.

### `GET /api/v1/reports/help-request-summary`

- **Auth:** ADMIN
- **Purpose:** The ONE surviving report: counts by request type x status over a bound date range, rendered on screen and downloadable as CSV from the same endpoint.
- **Request:** `query ReportQuery: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', format?: 'json'|'csv' (default json) }`
- **Response:** `200 json: { from, to, generatedAt, rows: [{ typeCode, typeLabel, SUBMITTED, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, total }], totals: { SUBMITTED, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, total } }. 200 csv: text/csv with Content-Disposition: attachment; filename="help-request-summary-2026-09-13_2026-09-20.csv". 422 when to < from or the range exceeds 366 days.`
- **Serves:** /admin/system-reports
- **Notes:** One endpoint, two formats - the CSV download is a plain <a [href] download> navigation, so the SameSite=Lax session cookie is attached automatically on a same-origin GET (this is exactly why the cookie is Lax and not Strict). One SQL statement: request_types LEFT JOIN help_requests GROUP BY request_type_id with SUM(CASE WHEN status=...). The other three report cards (User Activity, Volunteer Performance, System Logs) are DELETED from the template, not stubbed. 'Reports' is an explicit MCA rubric line, which is why one card survives.

---

## Auth flow

--- THE ONE-SENTENCE VERSION ---
One httpOnly SameSite=Lax cookie holding a 12-hour HS256 JWT, verified against users.token_version on every request, with requireAuth mounted on the WHOLE /api/v1 router behind an explicit public allowlist. No refresh rotation, no CSRF token - both cut as reasoned decisions, both prepared viva answers.

--- COOKIE ---
name: `drms_session`
value: HS256 JWT
httpOnly: true          (JavaScript cannot read it; an XSS cannot exfiltrate the session)
sameSite: 'lax'         (not 'strict': a CSV download is a top-level same-origin GET navigation and Strict would still work, but Lax is what lets a bookmarked deep link into /requests/46 arrive authenticated)
secure: process.env.NODE_ENV === 'production'   (false on localhost, or the cookie is silently dropped over http and you lose an hour)
path: '/'
maxAge: 12 * 60 * 60 * 1000
No second cookie. No token in localStorage. No Authorization header anywhere in the project.

--- JWT ---
payload: { sub: <users.id>, role: 'ADMIN'|'VOLUNTEER'|'VICTIM', tv: <users.token_version>, iat, exp }
algorithm: HS256, secret from env JWT_SECRET (>=32 chars, validated at boot by config/env.ts - the server refuses to start without it)
expiresIn: '12h', identical to the cookie maxAge so the cookie and the token die together and there is no "cookie present but token expired" limbo.

--- THE REQUEST PATH, EVERY TIME ---
1. cookieParser() reads drms_session.
2. requireAuth: if the path is in PUBLIC_ROUTES, next(). Otherwise verify the JWT; on any failure -> 401 UNAUTHENTICATED.
3. One indexed lookup: `SELECT id, email, first_name, last_name, phone, role, status, home_district, home_lat, home_lng, token_version FROM users WHERE id = ?` (primary key). If row missing -> 401. If `row.token_version !== payload.tv` -> 401 (this is the revocation check). If `row.status === 'INACTIVE'` -> 403 ACCOUNT_INACTIVE.
4. `req.user = row` (typed by a declaration-merged Express.Request interface in src/types/express.d.ts). Every downstream service takes the actor from req.user and NEVER from the body.

That extra SELECT per request is deliberate: it costs one PK lookup at this scale and it buys instant revocation, instant deactivation and a never-stale role - which is what replaces the entire refresh-token subsystem.

--- DENY BY DEFAULT (the highest-scoring 10 lines in the backend) ---
```ts
// src/middleware/requireAuth.ts
const PUBLIC_ROUTES = new Set([
  'GET /health',
  'POST /auth/register',
  'POST /auth/login',
]);
// mounted ONCE, on the whole router, before any route is registered:
api.use(requireAuth);   // in routes/index.ts, line 1 of the mount block
```
requireAuth compares `${req.method} ${req.path}` (req.path is relative to the /api/v1 mount) against the Set. A route added later and forgotten is therefore 401 by default, not open. That sentence - "the failure mode of forgetting to protect a route is 401, not an open endpoint" - is the thing to say in demo step 8, with the curl ready.
requireRole('ADMIN') is a second, thinner middleware applied per-router or per-route; ownership scoping is NOT a middleware, it is folded into the WHERE clause of every query and into the serializers, because a middleware that fetches the row and a service that fetches it again is two round trips and two places to get it wrong.

--- REGISTRATION ---
POST /auth/register -> Zod validates (role restricted to VICTIM|VOLUNTEER at the schema level, cross-field password match via .refine, termsAccepted must be literal true) -> `bcryptjs.hash(password, 12)` (~250ms, pure JS, no node-gyp) -> one transaction: INSERT users (terms_accepted_at = UTC_TIMESTAMP(3), terms_version = '2026-01-v1'), and when role=VOLUNTEER also INSERT volunteer_profiles (approval_status 'PENDING') -> issue the cookie -> 201 SessionUser. No email verification, no verification token, no SMTP.

--- LOGIN ---
Rate limited (the only rate-limited route): express-rate-limit, windowMs 15min, max 6, key = `${req.ip}:${normalisedEmail}`, skipSuccessfulRequests: true, handler throws TOO_MANY_ATTEMPTS. Lookup by lowercased email; if no row, still run bcrypt.compare against a constant dummy hash so response timing does not leak account existence; on success UPDATE last_login_at, issue the cookie, return SessionUser. The client then routes by role: ADMIN -> /dashboard, VOLUNTEER -> /volunteer/dashboard, VICTIM -> /victim/dashboard.

--- LOGOUT ---
`UPDATE users SET token_version = token_version + 1 WHERE id = ?` then `res.clearCookie('drms_session', { path: '/' })`. Every other device holding that JWT is dead on its next request. This is "logout everywhere" for one UPDATE, and it is the honest half of the refresh-rotation story you cut.

--- CSRF: DELIBERATELY ABSENT ---
Three facts make a token redundant here and the report says so as a decision, not an omission: (1) the SPA and the API are same-origin in production (one Express process serves both) and same-origin via the ng-serve proxy in dev, (2) the cookie is SameSite=Lax, and (3) every mutation in the entire API is POST or PATCH - Lax does not attach the cookie to a cross-site non-GET. No mutation is ever a GET; the CSV download is a GET but is idempotent and read-only. The follow-up you will be asked: "the day the API moves to a separate origin, SameSite becomes None, and a double-submit token becomes mandatory."

--- REFRESH ROTATION: DELIBERATELY ABSENT ---
No refresh_tokens table, no families, no reuse detection. A 12-hour token outlives any viva, and a rotation bug is the single most likely thing to log you out mid-demo. token_version gives you revocation, which is the property rotation was really buying.

--- THE ANGULAR SIDE, EXACTLY ---
app.config.ts:
```ts
provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor, errorInterceptor])),
provideRouter(routes, withComponentInputBinding()),
provideAppInitializer(() => inject(AuthStore).restore()),
```
`credentialsInterceptor` (5 lines): `next(req.clone({ withCredentials: true }))`. Strictly redundant same-origin (fetch sends same-origin cookies by default) but it is the one line that keeps the app working if the API is ever split off, and it costs nothing.
`errorInterceptor`: the 401/403/404/409/422/0 mapping in the error model above.
`AuthStore` (plain @Injectable({providedIn:'root'}) with signals, no NgRx): `user = signal<SessionUser|null>(null)`, `isAuthed = computed(() => !!this.user())`, `role = computed(() => this.user()?.role ?? null)`, and `restore()` which GETs /auth/me and `catchError(() => of(null))` so a 401 at boot resolves cleanly instead of blocking the app. WITHOUT provideAppInitializer, every F5 during the viva bounces a logged-in examiner to the login screen mid-answer.
Guards (functional, three files): `authGuard` (isAuthed else redirect to /auth/login with returnUrl), `roleGuard(...roles)` (else /forbidden), `guestGuard` (already authed -> role landing page, so /auth/login is not reachable while logged in). Applied on every route; the role-filtered sidebar is UX only and the server is the enforcement.
Dev: `frontend/proxy.conf.json` = `{ "/api": { "target": "http://localhost:3000", "secure": false } }` wired into angular.json serve options, so dev is ALSO same-origin and the cookie behaves identically to production. Develop on ng serve + proxy all month; rehearse the built single-process path three days before the demo.
Prod: `npm run build && npm start` - one Node process on :3000 serving dist/frontend/browser via express.static plus a TERMINAL `app.use((req,res) => res.sendFile(index))` mounted AFTER `app.use('/api/v1', api)`. Express 5 uses path-to-regexp v8 and `app.get('*')` THROWS at startup; every SPA-fallback snippet online is Express 4. The CORS block is deleted outright, not fixed.

--- SESSION COUNT, WHICH BITES ON DEMO DAY ---
One httpOnly cookie per browser profile = ONE session per profile. Four simultaneous roles therefore need four browser contexts: Chrome normal = ADMIN, Chrome incognito = VICTIM Priya, Edge normal = VOLUNTEER Arun, Edge incognito = VOLUNTEER Meera. Pre-log-in all four thirty minutes before.

---

## Error model

EVERY non-2xx response in the system has exactly this body. No exceptions, no bare strings, no HTML error pages from Express.

```json
{
  "error": {
    "code": "ALREADY_CLAIMED",
    "message": "Already accepted by Arun K.",
    "fieldErrors": { "confirmPassword": "Passwords do not match" },
    "details": { "helpRequestId": 46 }
  }
}
```

`code` is a stable UPPER_SNAKE string the client branches on. `message` is human-readable and safe to show in a toast verbatim (it never contains SQL, stack frames or another user's data). `fieldErrors` appears only on 422. `details` appears only where the client needs a value (helpRequestId, allowed transitions).

--- CODE -> STATUS TABLE (backend/src/http/AppError.ts) ---

| code | HTTP | thrown by |
|---|---|---|
| VALIDATION_FAILED | 422 | the Zod validate() middleware (always carries fieldErrors) |
| UNAUTHENTICATED | 401 | requireAuth: no cookie, bad signature, expired, token_version mismatch |
| INVALID_CREDENTIALS | 401 | POST /auth/login (same message for unknown email and wrong password) |
| ACCOUNT_INACTIVE | 403 | login or requireAuth when users.status='INACTIVE' |
| FORBIDDEN | 403 | requireRole, and every ownership check |
| VOLUNTEER_NOT_APPROVED | 403 | claim/assign when approval_status != 'APPROVED' |
| NOT_FOUND | 404 | any id that does not exist, or that the caller may not even know exists |
| ALREADY_CLAIMED | 409 | claim/assign: lock branch, errno 1062 on uq_one_active_assignment, errno 1205, errno 1213 |
| FEEDBACK_EXISTS | 409 | errno 1062 on uq_feedback_help_request |
| EMAIL_TAKEN / PHONE_TAKEN | 409 | errno 1062 on uq_users_email / uq_users_phone |
| ILLEGAL_TRANSITION | 400 | assignment.service transition table, and cancel on a terminal request (details: { from, to, allowed }) |
| HOURS_REQUIRED | 422 | PATCH /assignments/:id with status=COMPLETED and no hoursLogged |
| REQUEST_NOT_COMPLETED | 422 | feedback on a non-COMPLETED request |
| CANNOT_DEACTIVATE_SELF / LAST_ADMIN | 422 | admin user guardrails |
| TOO_MANY_ATTEMPTS | 429 | express-rate-limit on /auth/login |
| INTERNAL | 500 | anything unmapped; message is always the constant "Something went wrong." |

--- THE MySQL errno TRANSLATION LAYER (backend/src/http/errorHandler.ts) ---

errno 1062 ER_DUP_ENTRY covers THREE different business outcomes, so it must be disambiguated by index name from err.message, never by the full string. MySQL 8.0 formats it as `Duplicate entry '46' for key 'assignments.uq_one_active_assignment'` WITH the table prefix (5.7 emitted the bare index name), so match on a substring:

```ts
if (err.errno === 1062) {
  const m = String(err.message);
  if (m.includes('uq_one_active_assignment')) throw new AppError('ALREADY_CLAIMED', 409, '...');
  if (m.includes('uq_feedback_help_request')) throw new AppError('FEEDBACK_EXISTS', 409, 'Feedback has already been submitted for this request.');
  if (m.includes('uq_users_email'))           throw new AppError('EMAIL_TAKEN', 409, 'An account with this email already exists.');
  if (m.includes('uq_users_phone'))           throw new AppError('PHONE_TAKEN', 409, 'This phone number is already registered.');
}
```
Also mapped: 1452 ER_NO_REFERENCED_ROW_2 -> 422 VALIDATION_FAILED ("Unknown reference value"); 3819 ER_CHECK_CONSTRAINT_VIOLATED -> 422; 1205 ER_LOCK_WAIT_TIMEOUT and 1213 ER_LOCK_DEADLOCK -> 409 ALREADY_CLAIMED on the claim path, 503 elsewhere.

--- THE HANDLER ITSELF ---

One terminal `app.use((err, req, res, _next) => ...)` mounted AFTER the API router and AFTER the SPA fallback. It logs `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}` plus the stack to stderr for every 500, and NEVER puts err.message into the response for an unmapped error. Express 5 forwards rejected promises from async handlers to this middleware automatically, so there is no asyncHandler wrapper anywhere in this codebase - that is an Express 4 artifact and deleting it removes a wrapper from ~28 route registrations.

--- WHAT THE ANGULAR SIDE DOES WITH IT (errorInterceptor, one file) ---

401 -> AuthStore.clear() + router.navigateByUrl('/auth/login'), EXCEPT when the failing URL is /auth/me (the bootstrap probe) or /auth/login (the form shows its own inline error).
403 -> router.navigateByUrl('/forbidden') for a navigation-triggered call; a toast for an in-page action. VOLUNTEER_NOT_APPROVED specifically sets a banner signal on the volunteer store instead.
404 -> router.navigateByUrl('/not-found').
409 -> ToastService.error(error.message) and rethrow; the available-requests facade additionally removes the card from its signal.
422 -> rethrow untouched; the calling form maps error.fieldErrors onto its FormGroup via `control.setErrors({ server: msg })`.
0 or 5xx -> ToastService.error('Server unreachable. Is the API running?') - the message you want on screen at 10am on demo day.

---

## List envelope

EVERY collection endpoint in the API returns this exact shape. There is no second list format, and single resources are returned BARE (no `{ data: ... }` wrapper) so the Angular types stay flat.

```ts
// backend/src/http/envelope.ts
export interface ListEnvelope<T> {
  items: T[];
  page: number;                      // 1-based, echoed back
  pageSize: number;                  // echoed back after clamping
  total: number;                     // rows matching the filter, ignoring page
  counts: Record<string, number>;    // facet counts, ALWAYS present, ALWAYS includes "ALL"
}

export function listEnvelope<T>(
  items: T[], page: number, pageSize: number, total: number, counts: Record<string, number>,
): ListEnvelope<T> {
  return { items, page, pageSize, total, counts };
}
```

Example (`GET /api/v1/requests?scope=mine&status=SUBMITTED&page=1`):
```json
{
  "items": [ { "id": 46, "reference": "REQ-2026-000046", "type": { "code": "MEDICAL", "label": "Medical Assistance", "iconKey": "heartbeat", "colorKey": "red" }, "urgency": "CRITICAL", "status": "SUBMITTED", "district": "ERNAKULAM", "locationText": "near Aluva Metro Station", "peopleCount": 4, "submittedAt": "2026-09-20T04:31:07.412Z", "distanceKm": null, "assignment": null } ],
  "page": 1, "pageSize": 5, "total": 3,
  "counts": { "ALL": 9, "SUBMITTED": 3, "ASSIGNED": 1, "IN_PROGRESS": 2, "COMPLETED": 2, "CANCELLED": 1 }
}
```

WHY `counts` IS IN THE ENVELOPE AND NOT A SECOND ENDPOINT: the five filter pills need their badges to reflect the WHOLE result set while `items` and `total` reflect the CURRENT filter. Two queries would race and disagree. So `counts` is always computed over the filter set MINUS the facet being counted, and it comes back in the same round trip from one aggregate statement:

```sql
SELECT COUNT(*) AS ALL_,
       SUM(status='SUBMITTED')   AS SUBMITTED,
       SUM(status='ASSIGNED')    AS ASSIGNED,
       SUM(status='IN_PROGRESS') AS IN_PROGRESS,
       SUM(status='COMPLETED')   AS COMPLETED,
       SUM(status='CANCELLED')   AS CANCELLED
  FROM help_requests
 WHERE submitted_by_user_id = ?;          -- the scope predicate, WITHOUT the status filter
```
MySQL has no `FILTER (WHERE ...)`, so this is `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` (the `SUM(bool)` form above is the same thing shorter). Here the dialect difference is an ADVANTAGE: all six counts plus the total arrive in ONE round trip instead of six.

`counts` KEYS ARE SCOPE-DEPENDENT, and that is documented rather than hidden:
- `scope=mine`, `scope=all`, `GET /disaster-events` -> the status facet (`ALL` + the five request statuses / `ACTIVE|UPCOMING|PAST`)
- `scope=available` -> the urgency facet: `{ ALL, CRITICAL, HIGH, MEDIUM, LOW }`
- `scope=assigned` -> the assignment facet: `{ ALL, ASSIGNED, IN_PROGRESS, AWAITING_CONFIRMATION, COMPLETED }`
- `GET /users` -> `{ ALL, ADMIN, VOLUNTEER, VICTIM, PENDING_VOLUNTEERS }`
- `GET /notifications` -> `{ ALL, UNREAD }`
- `GET /shelters` -> `{ ALL, OPEN, FULL, CLOSED }`

PAGINATION RULES (one place, `PaginationQuery` in schemas/common.ts): `page` defaults to 1 and is clamped to >= 1; `pageSize` has a per-endpoint default (victim my-requests 5 to match the existing UI, card grids 9, admin tables 10) and is HARD-CLAMPED to 50 server-side so `?pageSize=100000` cannot be used to dump the database. `LIMIT ? OFFSET ?` with `(page-1)*pageSize`. `totalPages` is NOT sent - the client computes `Math.ceil(total / pageSize)`, which also kills the existing "Page 1 of 0" bug because the pagination bar is gated on `total > pageSize` instead of on a server-supplied zero.

ANGULAR SIDE: ONE generic interface `ListEnvelope<T>` in `frontend/src/app/core/api/types.ts`, and ONE `<app-state-panel [loading] [error] [empty]>` component that every list screen wraps, so loading/error/empty is written once and swept across all 19 screens in the week-4 pass.

---

## Folder structure

```
The API lives in the EXISTING `backend/` folder (not `apps/api`, and there is no npm workspace - packages/contracts was cut, so Zod runs backend-only and the frontend gets hand-written interfaces). Six routers named EXACTLY after the six Level-1 DFD processes, so the DFD falls out of files you already wrote.

```
D:/Program/Angular/Disaster Management/
├─ docker-compose.yml                 # mysql:8.0 (--default-time-zone=+00:00, healthcheck, named volume) + adminer:8080
├─ db/
│  ├─ schema.sql                      # 10 CREATE TABLEs, hand-written, transcribed verbatim into the report
│  └─ seed.sql                        # all timestamps DATE_SUB(NOW(), INTERVAL n DAY); explicit column lists (error 3105)
├─ backend/
│  ├─ package.json                    # "dev": "tsx watch src/server.ts", "start": "node --import tsx src/server.ts",
│  │                                  # "test": "node --import tsx --test tests/*.test.ts"
│  │                                  # deps: express@5 zod@^3.23 mysql2 bcryptjs jsonwebtoken cookie-parser
│  │                                  #       express-rate-limit dotenv | dev: tsx typescript supertest @types/*
│  │                                  # REMOVE: cors, @types/cors, nodemon, ts-node
│  ├─ .env.example                    # PORT, DB_*, JWT_SECRET, NODE_ENV, TERMS_VERSION
│  ├─ tsconfig.json                   # module NodeNext, target ES2022, strict (the shipped one is CommonJS + ts-node)
│  ├─ scripts/race-test.mjs           # 10 parallel claims -> 1x201, 9x409. Demo step 12.
│  ├─ tests/                          # 12 node:test + Supertest files = the Testing chapter's table
│  │  ├─ auth.test.ts  requests.test.ts  claim-race.test.ts  rbac.test.ts
│  │  ├─ assignment-transitions.test.ts  feedback.test.ts  pagination.test.ts
│  │  └─ helpers/agent.ts             # supertest agent that keeps the drms_session cookie jar per role
│  └─ src/
│     ├─ server.ts                    # composition root ONLY: cookieParser, express.json({limit:'100kb'}),
│     │                               # app.use('/api/v1', api), express.static(dist), terminal SPA app.use(), errorHandler, listen
│     ├─ config/env.ts                # Zod-validated process.env; throws at boot if JWT_SECRET is short
│     ├─ types/express.d.ts           # declare global { namespace Express { interface Request { user?: AuthUser; valid: ... } } }
│     ├─ db/
│     │  ├─ pool.ts                   # mysql2/promise createPool({ timezone:'Z', dateStrings:false, decimalNumbers:true,
│     │  │                            #   connectionLimit:10, namedPlaceholders:false, supportBigNumbers:true })
│     │  └─ withTransaction.ts        # <T>(fn:(c:PoolConnection)=>Promise<T>) => begin/commit/rollback/release, one place
│     ├─ http/
│     │  ├─ AppError.ts               # code + status + message + fieldErrors + details
│     │  ├─ errorHandler.ts           # AppError -> body; mysql errno 1062/1452/3819/1205/1213 translation; 500 fallback
│     │  ├─ validate.ts               # Zod middleware -> req.valid (NOT req.query: Express 5 makes req.query a getter and
│     │  │                            #   assigning to it THROWS - this is the single most annoying Express 5 landmine)
│     │  └─ envelope.ts               # listEnvelope(items, page, pageSize, total, counts)
│     ├─ middleware/
│     │  ├─ requireAuth.ts            # PUBLIC_ROUTES Set + JWT verify + token_version check. Mounted on the WHOLE router.
│     │  ├─ requireRole.ts            # requireRole('ADMIN'), requireRole('VOLUNTEER','ADMIN')
│     │  └─ loginRateLimit.ts         # express-rate-limit, /auth/login only
│     ├─ schemas/                     # ZOD = THE SRS. Transcribed into the report's numbered functional requirements.
│     │  ├─ enums.ts  common.ts  auth.schema.ts  request.schema.ts
│     │  └─ assignment.schema.ts  feedback.schema.ts  admin.schema.ts
│     ├─ reference/kerala-districts.ts# 14 { code, label, lat, lng }. Mirrored as the Angular dropdown options.
│     ├─ routes/
│     │  ├─ index.ts                  # const api = Router(); api.use(requireAuth); api.use('/auth', authRoutes); ...
│     │  ├─ auth.routes.ts            # DFD P1  Manage Access        -> /auth/*  (+ PATCH /auth/me)
│     │  ├─ requests.routes.ts        # DFD P2  Intake Help Request  -> POST/GET /requests, GET /requests/:id, /cancel
│     │  ├─ assignments.routes.ts     # DFD P3  Dispatch & Assign    -> /requests/:id/claim, /requests/:id/assign, PATCH /assignments/:id
│     │  ├─ notifications.routes.ts   # DFD P4  Track & Notify       -> /notifications/*, /dashboard/*
│     │  ├─ feedback.routes.ts        # DFD P5  Collect Feedback     -> POST /requests/:id/feedback
│     │  └─ admin.routes.ts           # DFD P6  Administer & Report  -> /users/*, /disaster-events, /shelters, /reports/*, /reference
│     ├─ controllers/                 # thin: read req.valid + req.user, call a service, res.status().json(). No SQL, no rules.
│     │  └─ auth. request. assignment. feedback. notification. dashboard. user. event. shelter. report. reference.
│     ├─ services/                    # ALL business rules + ALL transactions live here
│     │  ├─ auth.service.ts           # hash, compare, sign, token_version
│     │  ├─ request.service.ts        # create (+ location resolution + event auto-attach), list-by-scope, detail, cancel
│     │  ├─ claim.service.ts          # THE atomic claim. ONE function, called by both self-claim and admin assign.
│     │  ├─ assignment.service.ts     # LEGAL_TRANSITIONS const + the completion side effects
│     │  ├─ feedback.service.ts  notification.service.ts  dashboard.service.ts
│     │  └─ user.service.ts (guardrails)  event.service.ts  report.service.ts
│     ├─ repositories/                # raw parameterised SQL, one function per query, no ORM
│     │  ├─ user.repo.ts  request.repo.ts  assignment.repo.ts  statusEvent.repo.ts
│     │  └─ feedback.repo.ts  notification.repo.ts  event.repo.ts  shelter.repo.ts  requestType.repo.ts
│     ├─ serializers/                 # THE PII GATE. The only files that can leak another user's phone number.
│     │  ├─ request.serializer.ts     # toListItem(row, viewer) / toDetail(row, viewer) - role-aware projection
│     │  └─ user.serializer.ts  notification.serializer.ts
│     └─ util/
│        ├─ geo.ts                    # distanceSql(), districtCentroid(), ST_Distance_Sphere helpers (SRID 0, lng-first)
│        ├─ reference.ts              # CONCAT('REQ-', YEAR(submitted_at), '-', LPAD(id,6,'0')) formatting, one place
│        └─ csv.ts                    # rows -> RFC4180 string + Content-Disposition
```

WHY THIS SHAPE, IN ONE LINE EACH: controllers are thin so the report's Implementation chapter can quote a service function as "the business logic"; repositories are raw SQL so every query is visible in the report and the generated-column unique index needed no ORM escape hatch; serializers are separate because "which fields does a volunteer see before accepting?" must be answerable by opening ONE file; withTransaction.ts exists so no route can forget a rollback.

=== SURVEY COVERAGE CROSS-CHECK (every impliedServerAction in screen-survey.md, accounted for) ===

SERVED: victim profile/greeting -> /auth/me. Notifications list/mark-read/unread-count -> /notifications*. Open-request count -> /dashboard/victim. Create help request + reference data + server validation + attach active event -> POST /requests + /reference. List own requests filtered+paginated+per-status counts -> GET /requests?scope=mine. Single request detail + status timeline + assigned volunteer contact -> GET /requests/:id. Cancel -> /requests/:id/cancel. Feedback create + one-per-request + ownership + COMPLETED check + volunteer rating recompute -> POST /requests/:id/feedback. Volunteer KPIs (all four) + current assignments -> /dashboard/volunteer. Open pool with type filter, urgency|distance|newest sort, real distance, exclusion of claimed -> GET /requests?scope=available. Atomic accept with second-claimant rejection -> POST /requests/:id/claim. Assignment status state machine with legal-transition check, progress write, completedAt + hours -> PATCH /assignments/:id. Admin user list with search/pagination, role change, activate/deactivate, self-delete + last-admin guards -> GET/PATCH /users. Volunteer approval -> POST /users/:id/volunteer-approval. Admin request monitoring with combined server-side filters + pagination -> GET /requests?scope=all. Eligible-volunteer picker + assign -> GET /users?role=VOLUNTEER&approvalStatus=APPROVED + POST /requests/:id/assign. Notify volunteer and victim on assignment -> in-app notifications inside the claim transaction. Disaster event list with derived status + create -> GET/POST /disaster-events. Associate requests with an event -> auto-attach on insert. Admin KPI aggregate + 7-day time series + activity feed with deep links -> /dashboard/admin. Help Request Summary report + CSV download -> /reports/help-request-summary. Login/register/logout/me/role-based landing/rate limiting -> /auth/*. Terms acceptance -> users.terms_accepted_at on register. Role-filtered menu -> /auth/me role + client guards, enforced server-side.

DELIBERATELY NOT SERVED (feature cut; DELETE the control, never leave it dead): Google OAuth. Forgot/reset password. Email verification. Change password. Avatar upload (CSS initials instead). Global header search. 'View all notifications' page. Support groups / events / RSVP / 'Find Support'. Safety-resource articles. Geocoding and reverse geocoding. Browser geolocation. Map tiles and markers. Photo/file upload. Duplicate-request detection. Draft resume server-side (sessionStorage instead). SMS/email acknowledgements. Escalation on CRITICAL. Release/abandon an assignment by the volunteer (admin cancel RELEASEs it). Re-open or duplicate a cancelled request. Volunteer presence/heartbeat ('Volunteers Online' becomes 'Approved Volunteers'). Service health panel (the /health endpoint exists but nothing renders it). Audit-log export / System Logs. User Activity and Volunteer Performance reports. Background report jobs. Event edit/detail/archive. Shelter CRUD. Add/Delete user. Request-type CRUD. WebSocket/SSE push (15s polling + a manual Refresh button). Each of these is a line in the report's Future Scope with a reason - enumerating nine deliberately-dropped capabilities with a reason each outscores "I ran out of time".
```

---

## Shared Zod contracts

```ts
Zod runs BACKEND-ONLY (the packages/contracts workspace was cut). These files ARE the SRS: the report's numbered functional requirements are transcribed out of them, which is what makes the 32-hour documentation budget achievable. Pin `zod@^3.23` — v4 renames enough of this to cost you an evening.

```ts
// ============================================================
// backend/src/schemas/enums.ts   — the single source of every code value
// ============================================================
import { z } from 'zod';

export const Role            = z.enum(['ADMIN', 'VOLUNTEER', 'VICTIM']);
export const SelfSignupRole  = z.enum(['VICTIM', 'VOLUNTEER']);          // ADMIN is unreachable by construction
export const UserStatus      = z.enum(['ACTIVE', 'INACTIVE']);
export const ApprovalStatus  = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const Urgency         = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);          // declaration order = severity order
export const RequestStatus   = z.enum(['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const AssignmentStatus= z.enum(['ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED', 'RELEASED']);
export const RequestTypeCode = z.enum(['MEDICAL', 'FOOD_WATER', 'SHELTER', 'RESCUE', 'OTHER']);
export const DisasterType    = z.enum(['FLOOD','CYCLONE','LANDSLIDE','EARTHQUAKE','FIRE','DROUGHT','OTHER']);
export const Severity        = z.enum(['LOW', 'MODERATE', 'SEVERE', 'CATASTROPHIC']);
export const ShelterStatus   = z.enum(['OPEN', 'FULL', 'CLOSED']);
export const NotificationType= z.enum(['REQUEST_SUBMITTED','REQUEST_ASSIGNED','REQUEST_STATUS_CHANGED',
                                       'REQUEST_COMPLETED','FEEDBACK_RECEIVED','VOLUNTEER_APPROVED']);
export const KeralaDistrict  = z.enum([
  'THIRUVANANTHAPURAM','KOLLAM','PATHANAMTHITTA','ALAPPUZHA','KOTTAYAM','IDUKKI','ERNAKULAM',
  'THRISSUR','PALAKKAD','MALAPPURAM','KOZHIKODE','WAYANAD','KANNUR','KASARAGOD',
]);

export type Role = z.infer<typeof Role>;
export type RequestStatus = z.infer<typeof RequestStatus>;
export type AssignmentStatus = z.infer<typeof AssignmentStatus>;

// ============================================================
// backend/src/schemas/common.ts
// ============================================================
import { z } from 'zod';

export const IdParam = z.object({ id: z.coerce.number().int().positive() });

/** pageSize default differs per endpoint; max is ALWAYS 50 so ?pageSize=100000 cannot dump the DB. */
export const pagination = (defaultPageSize = 10) => z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(defaultPageSize),
});

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** India: 10 digits starting 6-9, optional +91. Stored normalised to 10 digits. */
export const PhoneIN = z.string().trim()
  .regex(/^(\+91[-\s]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
  .transform(s => s.replace(/\D/g, '').slice(-10));

export const Email = z.string().trim().toLowerCase().email('Enter a valid email address').max(191);

// ============================================================
// backend/src/schemas/auth.schema.ts
// ============================================================
import { z } from 'zod';
import { SelfSignupRole, Role, UserStatus, KeralaDistrict } from './enums.js';
import { Email, PhoneIN } from './common.js';

const Password = z.string().min(8, 'Password must be at least 8 characters').max(72); // bcrypt truncates past 72

export const RegisterBody = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName:  z.string().trim().min(1).max(60),
  email:     Email,
  phone:     PhoneIN.optional(),
  password:  Password,
  confirmPassword: z.string(),
  role:      SelfSignupRole,                       // FR-1.2: self-registration may only create VICTIM or VOLUNTEER
  homeDistrict: KeralaDistrict.optional(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Conditions' }) }),
}).refine(v => v.password === v.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],   // path drives fieldErrors.confirmPassword
});

export const LoginBody = z.object({ email: Email, password: z.string().min(1, 'Password is required') });

/** Mass-assignment is closed HERE: role/email/status are absent, so no crafted body can self-promote. */
export const UpdateMeBody = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName:  z.string().trim().min(1).max(60).optional(),
  phone:     PhoneIN.nullable().optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'No changes supplied' });

// ============================================================
// backend/src/schemas/request.schema.ts
// ============================================================
import { z } from 'zod';
import { RequestTypeCode, Urgency, RequestStatus, KeralaDistrict } from './enums.js';
import { pagination, Email, PhoneIN, IsoDate } from './common.js';

export const CreateRequestBody = z.object({
  typeCode:     RequestTypeCode,
  urgency:      Urgency,
  district:     KeralaDistrict,                                        // seeded dropdown; replaces browser GPS
  locationText: z.string().trim().min(3, 'Describe the landmark').max(200),
  peopleCount:  z.coerce.number().int().min(1, 'At least 1 person').max(500),   // FR-2.4; integration test 7
  description:  z.string().trim().min(10, 'Please add at least 10 characters').max(2000),
  contactPhone: PhoneIN.optional(),
  contactEmail: Email.optional(),
}).refine(v => !!v.contactPhone || !!v.contactEmail, {
  message: 'Provide a phone number or an email so we can reach you', path: ['contactPhone'],
});
// NOTE: `source` is NOT accepted from the client — the service hardcodes 'WEB'.

export const ListRequestsQuery = pagination(10).extend({
  scope:     z.enum(['mine', 'available', 'assigned', 'all']),
  status:    RequestStatus.optional(),
  typeCode:  RequestTypeCode.optional(),
  district:  KeralaDistrict.optional(),
  urgency:   Urgency.optional(),
  q:         z.string().trim().min(1).max(60).optional(),   // scope=all only
  from:      IsoDate.optional(),
  to:        IsoDate.optional(),
  sort:      z.enum(['urgency', 'distance', 'newest']).default('urgency'),  // scope=available only
}).refine(v => !(v.from && v.to) || v.from <= v.to, { message: '"from" must be on or before "to"', path: ['from'] });
// Scope authorisation is NOT in the schema — requestService.list() rejects scope='all' for a non-ADMIN
// and hard-binds submitted_by_user_id = me.id for scope='mine'. A schema cannot know who is asking.

export const CancelRequestBody = z.object({ reason: z.string().trim().max(255).optional() });

export const AssignRequestBody = z.object({ volunteerUserId: z.coerce.number().int().positive() });

// ============================================================
// backend/src/schemas/assignment.schema.ts
// ============================================================
import { z } from 'zod';

export const UpdateAssignmentBody = z.object({
  status:      z.enum(['IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED']).optional(),
  progressPct: z.coerce.number().int().min(0).max(100).optional(),
  hoursLogged: z.coerce.number().min(0).max(24)
                 .refine(n => Number.isInteger(n * 4), 'Log hours in quarter-hour steps').optional(),
  note:        z.string().trim().max(500).optional(),
}).refine(v => v.status !== 'COMPLETED' || v.hoursLogged !== undefined, {
  message: 'Hours are required to complete a task', path: ['hoursLogged'],   // FR-4.6: the only source of the Hours KPI
}).refine(v => Object.keys(v).length > 0, { message: 'No changes supplied' });

/** The legal-transition table. Lives in assignment.service.ts, quoted in the report's System Design chapter. */
export const LEGAL_TRANSITIONS = {
  ASSIGNED:              ['IN_PROGRESS', 'AWAITING_CONFIRMATION'],
  IN_PROGRESS:           ['AWAITING_CONFIRMATION', 'COMPLETED'],
  AWAITING_CONFIRMATION: ['COMPLETED'],
  COMPLETED:             [],
  RELEASED:              [],
} as const;   // ASSIGNED -> COMPLETED is therefore 400 ILLEGAL_TRANSITION. Demo step 14, test 10.

// ============================================================
// backend/src/schemas/feedback.schema.ts
// ============================================================
import { z } from 'zod';

export const CreateFeedbackBody = z.object({
  rating:            z.coerce.number().int().min(1, 'Please choose a rating').max(5),
  comments:          z.string().trim().max(2000).optional(),
  contactPermission: z.coerce.boolean().default(false),
});
// Ownership + COMPLETED-status are service rules (a MySQL CHECK cannot reference another table);
// one-per-request is uq_feedback_help_request, surfaced as 409 from errno 1062 — not an if-statement.

// ============================================================
// backend/src/schemas/admin.schema.ts
// ============================================================
import { z } from 'zod';
import { Role, UserStatus, ApprovalStatus, DisasterType, Severity, KeralaDistrict, ShelterStatus } from './enums.js';
import { pagination, IsoDate } from './common.js';

export const ListUsersQuery = pagination(10).extend({
  q: z.string().trim().min(1).max(60).optional(),   // anchored LIKE 'x%' — no leading wildcard, no pg_trgm
  role: Role.optional(), status: UserStatus.optional(), approvalStatus: ApprovalStatus.optional(),
});

export const AdminUpdateUserBody = z.object({ role: Role.optional(), status: UserStatus.optional() })
  .refine(v => Object.keys(v).length > 0, { message: 'No changes supplied' });
// CANNOT_DEACTIVATE_SELF and LAST_ADMIN are service guardrails checked inside the transaction with FOR UPDATE.

export const VolunteerApprovalBody = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason:   z.string().trim().max(255).optional(),
}).refine(v => v.decision !== 'REJECTED' || !!v.reason, { message: 'A reason is required to reject', path: ['reason'] });

const LatLng = { lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) };

export const CreateEventBody = z.object({
  name: z.string().trim().min(3).max(120),
  type: DisasterType, severity: Severity,
  district: KeralaDistrict.optional(),
  locationText: z.string().trim().min(3).max(120),
  centerLat: LatLng.lat, centerLng: LatLng.lng,
  radiusKm: z.coerce.number().int().min(1).max(500).default(25),
  helplineNumber: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
}).refine(v => !v.endDate || v.endDate > v.startDate, { message: 'End date must be after the start date', path: ['endDate'] });

export const ListSheltersQuery = pagination(20).extend({
  district: KeralaDistrict.optional(), status: ShelterStatus.optional(),
  nearLat: LatLng.lat.optional(), nearLng: LatLng.lng.optional(),
});

export const ReportQuery = z.object({
  from: IsoDate, to: IsoDate, format: z.enum(['json', 'csv']).default('json'),
}).refine(v => v.from <= v.to, { message: '"from" must be on or before "to"', path: ['from'] })
  .refine(v => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 366, { message: 'Range may not exceed 366 days' });

// ============================================================
// backend/src/http/validate.ts   — the ONE place Zod meets Express
// ============================================================
import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from './AppError.js';

export const validate = (parts: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }): RequestHandler =>
  (req, _res, next) => {
    try {
      // EXPRESS 5 LANDMINE: req.query is a lazy GETTER. Assigning to it throws
      // "Cannot set property query of #<IncomingMessage> which has only a getter".
      // So parsed output goes on req.valid, and controllers read req.valid.query — never req.query.
      req.valid = {
        body:   parts.body   ? parts.body.parse(req.body)     : undefined,
        query:  parts.query  ? parts.query.parse(req.query)   : undefined,
        params: parts.params ? parts.params.parse(req.params) : undefined,
      };
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const i of e.issues) fieldErrors[i.path.join('.') || '_'] = i.message;
        return next(new AppError('VALIDATION_FAILED', 422, 'Please correct the highlighted fields.', fieldErrors));
      }
      next(e);
    }
  };

// Usage — every mutating route looks exactly like this, and nothing else:
// router.post('/:id/claim', requireRole('VOLUNTEER','ADMIN'), validate({ params: IdParam }), claimController);
// router.post('/',          requireRole('VICTIM'),            validate({ body: CreateRequestBody }), createRequestController);
```

FRONTEND MIRROR (no Zod, no workspace): `frontend/src/app/core/api/types.ts` holds ~40 hand-written interfaces and the same string-literal unions (`export type RequestStatus = 'SUBMITTED' | ...`). They are typed by hand and kept honest by the 12 Supertest cases, not by a shared package — fighting workspace tsconfig paths against the Angular builder is a plausible full-day sink for a build that has 45 coding hours.

TWO TYPE-COERCION TRAPS THE REPOSITORY LAYER MUST HANDLE, or strictTemplates will surface them as render bugs:
1. MySQL has no BOOLEAN. `request_types.is_active` and `feedback.contact_permission` come back as `0`/`1`, so every row→DTO mapping does `Boolean(row.contact_permission)` or an `*ngIf` receives `0`.
2. `DECIMAL` comes back as a STRING from mysql2 unless the pool sets `decimalNumbers: true` — otherwise `ratingAvg` arrives as `"4.50"`, `hoursLogged` as `"2.50"`, and every arithmetic operation in the UI silently concatenates.
```
