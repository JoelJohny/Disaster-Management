# Angular Wiring Plan

26 screens. 37 estimated hours.

---

## Per-screen work

| Screen | Priority | Hours | Endpoints |
|---|---|---:|---|
| (infra) Phase 0 deletion + lazy routes + bundle | P0 | 2 |  |
| (infra) Core plumbing: app.config, interceptors, models, reference data | P0 | 2 | GET /api/v1/lookups/request-types |
| (infra) Auth layer: AuthStore, guards, session restore | P0 | 2.5 | GET /api/v1/auth/me |
| (infra) Shared UI kit | P0 | 3 |  |
| Login (/auth/login) | P0 | 1.5 | POST /api/v1/auth/login |
| Registration (/auth/register) | P0 | 1 | POST /api/v1/auth/register |
| Sidebar (layout) | P0 | 1 | POST /api/v1/auth/logout |
| Header (layout) — notification bell | P0 | 1.5 | GET /api/v1/notifications?limit=10<br>POST /api/v1/notifications/:id/read<br>POST /api/v1/notifications/read-all |
| Victim Dashboard (/victim/dashboard) — full copy rewrite | P0 | 2 | GET /api/v1/dashboard/victim<br>POST /api/v1/requests |
| Submit Request wizard (/victim/submit-request) | P0 | 3 | GET /api/v1/lookups/request-types<br>POST /api/v1/requests |
| My Requests (/victim/my-requests) | P0 | 1.5 | GET /api/v1/requests/mine?status=&page=&pageSize=<br>POST /api/v1/requests/:id/cancel |
| Request Detail (/requests/:id) — NEW SCREEN | P0 | 2.5 | GET /api/v1/requests/:id<br>POST /api/v1/requests/:id/cancel |
| Available Requests (/volunteer/available-tasks) | P0 | 1.5 | GET /api/v1/requests/available?typeId=&sort=&page=<br>POST /api/v1/requests/:id/claim |
| My Tasks (/volunteer/my-tasks) | P0 | 1.5 | GET /api/v1/assignments/mine<br>PATCH /api/v1/assignments/:id/status |
| Feedback (/victim/feedback/:requestId) | P0 | 1 | POST /api/v1/requests/:requestId/feedback |
| Admin Dashboard (/dashboard) | P0 | 1.25 | GET /api/v1/dashboard/admin |
| Admin All Requests (/admin/all-requests) | P0 | 1.5 | GET /api/v1/requests?q=&typeId=&status=&dateFrom=&page=<br>GET /api/v1/admin/volunteers?approval=APPROVED<br>POST /api/v1/requests/:id/assign |
| Admin User Management (/admin/user-management) | P0 | 1.25 | GET /api/v1/admin/users?q=&role=&status=&page=<br>PATCH /api/v1/admin/users/:id<br>POST /api/v1/admin/users/:id/approve |
| (infra) Forbidden + Not Found pages | P0 | 0.25 |  |
| Footer (layout) | P0 | 0.25 |  |
| Admin Disaster Events (/admin/disaster-management) | P1 | 1.25 | GET /api/v1/disaster-events<br>POST /api/v1/disaster-events |
| System Reports (/admin/system-reports) | P1 | 0.75 | GET /api/v1/reports/request-summary?from=&to=<br>GET /api/v1/reports/request-summary.csv?from=&to= |
| Volunteer Dashboard (/volunteer/dashboard) | P1 | 0.5 | GET /api/v1/dashboard/volunteer |
| User Profile (/profile) | P1 | 0.5 | GET /api/v1/auth/me<br>PATCH /api/v1/users/me |
| (sweep) Week-4 polish pass across all screens | P1 | 1.5 |  |
| Admin Shelters table (new, read-only) | P2 | 0.5 | GET /api/v1/shelters |

---

## Work detail

### (infra) Phase 0 deletion + lazy routes + bundle  ·  P0  ·  2h

- git rm --cached the staged frontend/public/main-*.js, styles-*.css, polyfills-*.js, index.html and .firebase/hosting.cHVibGlj.cache; gitignore public/* (keep !favicon.ico), .firebase/, .env*, dist/
- Delete all 21 boilerplate .spec.ts, firebase.json, .firebaserc, .firebase/, services/theme.ts, services/theme.spec.ts
- npm uninstall @angular/material @angular/cdk autoprefixer @fortawesome/free-brands-svg-icons
- Replace styles.scss with the 8-line Tailwind-only version; fix index.html <title>; delete the Material Icons AND Roboto <link> tags
- Rewrite app.routes.ts: loadComponent on every route, remove the duplicate empty-path redirect, remove the top-level '**' -> auth/login
- Add frontend/proxy.conf.json + angular.json serve.options.proxyConfig + .nvmrc; tighten the budget to 400kB warn / 500kB error
- Verify with npx ng build: expect ~305 kB initial, no budget warning

### (infra) Core plumbing: app.config, interceptors, models, reference data  ·  P0  ·  2h

- Replace app.config.ts (provideHttpClient(withFetch, withInterceptors), withComponentInputBinding, provideAppInitializer)
- Write core/http/api.config.ts, credentials.interceptor.ts, error.interceptor.ts (+ SKIP_ERROR_HANDLER, serverMessage)
- Write core/models/{api,auth,enums,request,admin,notification}.models.ts — ~150 hand-written interfaces, transcribed from backend/src/schemas/*.ts
- Write core/reference/{kerala-districts,enum-labels,icon-map}.ts and core/lookups/request-types.service.ts
- Write core/util/{poll,form-errors,validators,time-ago.pipe,enum-label.pipe}.ts

### (infra) Auth layer: AuthStore, guards, session restore  ·  P0  ·  2.5h

- core/auth/auth.store.ts — signals, computeds, homeRoute(), login/register/restoreSession/logout/clear/patchProfile with SKIP_ERROR_HANDLER on the three auth calls
- core/auth/auth.guards.ts — authGuard, guestGuard, roleGuard(...roles), all synchronous
- Wire canActivate onto every route; add the function redirect { path: '', redirectTo: () => inject(AuthStore).homeRoute() }
- Smoke test: hard-refresh on /admin/all-requests as an admin must stay there, not bounce to login

### (infra) Shared UI kit  ·  P0  ·  3h

- state-panel, toast.service + toast-host, confirm.service + confirm-host, modal-shell, initials-avatar, status-badge, urgency-badge
- Mount <app-toast-host/> and <app-confirm-host/> in app.html; delete app.ts's unused Header/Footer/Sidebar imports
- forbidden.ts and not-found.ts pages

### Login (/auth/login)  ·  P0  ·  1.5h

- First reactive form — budget the learning cost here, not on the wizard
- Typed NonNullableFormBuilder group, touched-gated inline errors, submitting signal, serverError banner, novalidate
- DELETE action='#', the 'Sign in with Google' button, the whole 'Or continue with' separator, the 'Forgot your password?' link and the faGoogle import
- Honour ?returnUrl, else navigate to auth.homeRoute()

### Registration (/auth/register)  ·  P0  ·  1h

- Victim|Volunteer radio, first/last name, email, phone, home district select from KERALA_DISTRICTS, password + confirm
- Group-level passwordsMatch validator; Validators.requiredTrue on the terms checkbox writing terms_accepted_at + termsVersion
- On success the server sets the cookie and returns SessionUser — go straight to homeRoute(), no second login

### Sidebar (layout)  ·  P0  ·  1h

- Delete the NavigationEnd subscription, updateActiveState(), the isActive bookkeeping and navigateTo() — ~60 lines — and use routerLink + routerLinkActive
- Split the one flat menuItems array into ADMIN_MENU / VOLUNTEER_MENU / VICTIM_MENU + a computed on auth.role()
- Remove the 'Provide Feedback' entry (feedback is now reached per-request) and wire a real logout()

### Header (layout) — notification bell  ·  P0  ·  1.5h

- Replace the hardcoded 'John Doe / Administrator' + placehold.co avatar with auth.fullName(), role label and <app-initials-avatar>
- Bell: real unread count from NotificationStore replacing the permanently-lit red dot; dropdown lists real rows with timeAgo and deep-links to /requests/:id; mark-read on click; 'Mark all read'
- pollWhileVisible(15000) in the component constructor + a visible Refresh button and a small 'Live' label
- DELETE the unbound global search box, the 'Settings' menu item (no route), the faSun/faMoon toggle and the Theme injection

### Victim Dashboard (/victim/dashboard) — full copy rewrite  ·  P0  ·  2h

- Rewrite ALL copy from victim-services to disaster-relief: 'Report an Incident'/'Find Support'/'My Cases' -> active disaster status, your open requests, nearest open shelter
- Card 1: active event card — 'Kerala Floods 2025 — SEVERE — ACTIVE in Ernakulam' with helpline_number as a tel: link
- Card 2: open request count -> /victim/my-requests. Card 3: nearest OPEN shelter with name, computed km and occupancy/capacity
- One large red SOS button: confirm dialog -> POST /requests with type=RESCUE, urgency=CRITICAL, the user's saved home district/lat/lng -> navigate to /requests/:id
- DELETE ENTIRELY: the Find Support / Get Help card, the 'Upcoming Support Group Meeting' + RSVP row, and the whole Safety Resources list ('How to Create a Safety Plan', 'Understanding Your Rights')

### Submit Request wizard (/victim/submit-request)  ·  P0  ·  3h

- ONE typed FormGroup with three nested groups (details / location / describe); swap currentStep for a step() signal
- Per-step validation in next(): groupFor(step).invalid -> markAllAsTouched() and return. This is what makes demo step 5 work
- Seeded Kerala district <select> with [ngValue] (NOT value) + landmark text + peopleCount min 1; type select driven by RequestTypesService
- sessionStorage draft on debounced valueChanges with takeUntilDestroyed(); cleared on success
- Replace <form action='#'> with (ngSubmit); POST then toast then router.navigate(['/requests', id]); applyServerFieldErrors on 422

### My Requests (/victim/my-requests)  ·  P0  ·  1.5h

- Delete allRequests/filteredRequests/paginatedRequests/updateRequestsView and getMockRequests() — the whole in-memory filter is rewritten, not re-pointed
- MyRequestsFacade: server-side status filter, server pagination, per-status counts rendered on the six filter pills from the envelope
- Working Cancel (confirm -> POST /cancel) which finally makes the existing 'Cancelled' pill reachable
- 'View Details' -> routerLink ['/requests', id]; 'Give Feedback' link on COMPLETED rows without feedback

### Request Detail (/requests/:id) — NEW SCREEN  ·  P0  ·  2.5h

- New component + facade + template. Does not exist today despite eight 'View Details' buttons across victim, volunteer and admin pointing at it
- Signal input id via withComponentInputBinding; load in an effect so a bell deep-link from one detail page to another re-fetches
- Header: computed reference REQ-YYYY-NNNNNN, status badge, urgency badge, type, people count, district + landmark, submitted timeAgo
- Timeline rail from request_status_events: from->to, actor name, actor role, note, timestamp
- Role-aware panels driven by what the server sends, not by template ifs: victim sees assignedVolunteer contact; volunteer sees victimContact only when non-null (i.e. after acceptance); admin sees both
- Action bar: victim Cancel / Give Feedback; volunteer Update Status; admin Assign / Cancel
- pollWhileVisible(15000) + manual Refresh so demo step 13 never stalls

### Available Requests (/volunteer/available-tasks)  ·  P0  ·  1.5h

- ADD THE ACCEPT BUTTON. The page subtitle already says 'accept a task' and no such control exists anywhere in the codebase
- Facade claim(id): 201 -> toast + remove card + navigate to /requests/:id; 409 -> interceptor toasts 'Already accepted by Arun K.' and the facade reloads the pool
- Real request-type filter (from RequestTypesService) and real sort select (urgency | distance | newest), both server-side
- Render distanceKm from the server's ST_Distance_Sphere result as '2.4 km away'; render CRITICAL urgency (missing today)
- Show 'Victim — contact released on acceptance' where the phone number would be; that placeholder is demo step 10
- DELETE the map/list toggle button — there has never been a map behind it

### My Tasks (/volunteer/my-tasks)  ·  P0  ·  1.5h

- Replace the mock array with GET /assignments/mine
- status-dialog.ts inside <app-modal-shell>: status select, progress range input, and hoursLogged + completionNotes made required via setValidators/updateValueAndValidity when status === 'COMPLETED'
- Do NOT client-validate the transition order — send ASSIGNED->COMPLETED and let the server 400; that is demo step 14
- Reconcile the vocabulary: 'Pending Confirmation' is AWAITING_CONFIRMATION on the ASSIGNMENT, not on the request
- Writable progress bar; this is the only live write path that feeds the 'Hours Contributed' KPI

### Feedback (/victim/feedback/:requestId)  ·  P0  ·  1h

- Route parameterised; signal input requestId via withComponentInputBinding
- Star rating becomes a FormControl (Validators.required, min 1) instead of a bare component property; keep the hover UX
- Comments textarea + contactPermission checkbox; POST and navigate back to /requests/:id
- Second submission returns 409 from the UNIQUE index -> interceptor toast 'Feedback already submitted'; that is demo step 15
- DELETE the old bare /victim/feedback sidebar route and link

### Admin Dashboard (/dashboard)  ·  P0  ·  1.25h

- Four KPI cards from real COUNT aggregates in one endpoint (Total Users, Active Requests, Volunteers, Resolved Today)
- Recent System Activity from request_status_events JOIN users: real actor, real timeAgo, <app-initials-avatar> instead of placehold.co, and a working routerLink to /requests/:id (every link is href='#' today)
- 7-day trend as seven divs with [style.height.%] from the GROUP BY DATE(submitted_at) array. No Chart.js
- DELETE the System Status panel (hardcodes 'Email Service: Degraded' forever) and the 'Create New Report' / 'Export Data' buttons
- Fix the duplicated Activity interface declared twice in dashboard.ts

### Admin All Requests (/admin/all-requests)  ·  P0  ·  1.5h

- Bind all four filter controls — they are completely unbound today — and apply them SERVER-side: q, typeId, status, dateFrom
- Add the missing 'Rescue / Evacuation' option by sourcing the type select from RequestTypesService
- Real pagination controls (the HTML comment promises them; there are zero)
- 'View' -> routerLink ['/requests', id]
- Assign dialog listing APPROVED volunteers, POSTing through the SAME claim service with assignedBy set

### Admin User Management (/admin/user-management)  ·  P0  ·  1.25h

- Debounced (300ms) server-side search via a FormControl valueChanges subscription — the one .subscribe() in the app
- Role change select, Activate/Deactivate toggle, and the Approve Volunteer action for approval_status = PENDING rows
- Surface the server's guardrail 409s as toasts: cannot deactivate yourself, cannot remove the last ADMIN
- <app-initials-avatar> replaces four placehold.co images; date joined rendered from a real timestamp
- DELETE the 'Add New User' button and the trash-can icon — users holding request history are deactivated, never deleted

### (infra) Forbidden + Not Found pages  ·  P0  ·  0.25h

- Designed 403 page with a 'Back to my dashboard' button using auth.homeRoute() — demo step 8 lands here twice
- 404 page inside the authenticated shell

### Footer (layout)  ·  P0  ·  0.25h

- Delete the Math.random() setInterval, systemStats, formatNumber(), getFormattedRevenue(), the Twitter/LinkedIn/GitHub social links and the four dead quick links (/docs, /api, /support, /privacy)
- Reduce to a one-line copyright plus a version string. Remove the unused FormsModule import

### Admin Disaster Events (/admin/disaster-management)  ·  P1  ·  1.25h

- List from the server with derivedStatus (ACTIVE / UPCOMING / PAST) computed in SQL — the shipped mock data contradicts itself precisely because status was stored
- Create New Event modal: name, type, severity, district (auto-patches centerLat/centerLng from KERALA_DISTRICTS), radiusKm, helplineNumber, startDate, endDate with an end>start cross-field validator
- DELETE the row-level Edit (pencil) and View Details (eye) icon buttons — editing is not built, so the buttons go rather than sit inert
- Demo step 17: after creating the event, a new request from Priya auto-attaches to it by radius

### System Reports (/admin/system-reports)  ·  P1  ·  0.75h

- DELETE three of the four cards (User Activity, Volunteer Performance, System Logs) and every Export button except one
- Bind the existing from/to date inputs to a reactive form group
- On-screen counts-by-type x status cross-tab table
- Download CSV via responseType:'blob' + URL.createObjectURL + a synthetic <a download> click, revoking the object URL in a finally. 'Reports' is an explicit MCA rubric line

### Volunteer Dashboard (/volunteer/dashboard)  ·  P1  ·  0.5h

- One aggregate GET feeding all four KPIs (Available Nearby, My Assigned Tasks, Completed This Month, Hours Contributed)
- Zero writes on this page; an unapproved volunteer sees an explanatory approval banner instead of the CTA

### User Profile (/profile)  ·  P1  ·  0.5h

- Delete getMockUser(); render auth.user() — name, email, role label, phone, join date, <app-initials-avatar>
- Edit form for firstName/lastName/phone only; role, email and created date are read-only. PATCH then auth.patchProfile()
- DELETE the Change Password card (three unbound unnamed inputs today) — the whole password-change flow is cut

### (sweep) Week-4 polish pass across all screens  ·  P1  ·  1.5h

- Sweep <app-state-panel> onto every one of the 12 data screens (they will have been built with ad-hoc @if blocks first)
- Grep the templates for href="#" and delete every remaining dead control — the survey counts roughly forty
- Grep for placehold.co and replace the last stragglers with <app-initials-avatar>
- Grep for 'Jane Doe', 'John Doe', 'AdminPro', 'Hello, frontend' and remove
- Fix any strictTemplates fallout from icon:any becoming a typed response and the mock arrays becoming signals — budget two uncomfortable days inside the coding total, not in this line item

### Admin Shelters table (new, read-only)  ·  P2  ·  0.5h

- Plain table of the 8 seeded shelters: name, district, occupancy/capacity, status pill, contact phone. No CRUD, no occupancy editing
- Add one sidebar entry under the admin Management group
- Only reason to build it: the shelters table otherwise only surfaces on the victim dashboard card, and an examiner asking 'where is this table used by the admin?' gets a better answer

---

## New files

| Path | Purpose |
|---|---|
| `D:/Program/Angular/Disaster Management/frontend/proxy.conf.json` | Dev-only same-origin shim: {"/api": {"target":"http://localhost:3000","secure":false,"changeOrigin":false}}. Wire it in angular.json at projects.frontend.architect.serve.options.proxyConfig. changeOrigin MUST stay false so the Host header stays localhost and the httpOnly session cookie is stored host-only for localhost. With this, every URL in the app is the relative string '/api/v1/...' and NOTHING changes when Express starts serving dist in week 4 — no environment.ts, no environment.prod.ts, no baseUrl token. |
| `D:/Program/Angular/Disaster Management/frontend/.nvmrc` | Pin Node (v24.13.1). Defence against the global Angular CLI v21.1.5 shadowing the v20.1.6 workspace: combined with using npx/npm scripts exclusively, never a bare `ng`. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/http/api.config.ts` | One line: `export const API = '/api/v1';`. Every facade imports this. Zero environment files. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/http/credentials.interceptor.ts` | HttpInterceptorFn. Only touches urls starting '/api/'. Adds withCredentials:true and header X-Requested-With: XMLHttpRequest. That header IS the project's CSRF story (a cross-site HTML form cannot set a custom header without triggering a preflight the server will fail) — it costs 6 lines and is the viva answer that replaces the cut double-submit token. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/http/error.interceptor.ts` | The global 401/403/409/422/429/0/5xx map, plus `export const SKIP_ERROR_HANDLER = new HttpContextToken<boolean>(() => false)` and `serverMessage(e)`. Rule that matches demo step 8 exactly: 403 on a GET navigates to /forbidden, 403 on a non-GET toasts (unapproved-volunteer claim). 422 does NOTHING so the form owns field errors. Always rethrows. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/auth/auth.store.ts` | Root singleton, signals only. _user signal + isAuthenticated/role/fullName/initials/isApprovedVolunteer computeds + homeRoute(). login/register/restoreSession/logout/clear/patchProfile. login, register and restoreSession send SKIP_ERROR_HANDLER so their 401/409/429 surfaces inline on the form instead of toasting and redirecting. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/auth/auth.guards.ts` | authGuard, guestGuard, roleGuard(...roles) as functional CanActivateFn. All three are SYNCHRONOUS because provideAppInitializer already resolved /auth/me before the router boots — that is the reason session restore is an initializer and not an APP_BOOTSTRAP effect, and it is a viva sentence. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/models/api.models.ts` | `ListEnvelope<T> { items: T[]; page: number; pageSize: number; total: number; counts: Record<string, number> }` and `ApiErrorBody { error: { code: string; message: string; fields?: Record<string,string> } }`. The envelope type is imported by all six list facades. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/models/enums.ts` | String-literal unions mirroring the 14 MySQL enums exactly (UPPER_SNAKE): Role, UserStatus, ApprovalStatus, Urgency, RequestStatus, AssignmentStatus, RequestSource, LocationSource, DisasterType, Severity, ShelterStatus, NotificationType, KeralaDistrict. Plus ordered const arrays (URGENCY_ORDER, REQUEST_STATUSES) used by filter pills and selects. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/models/auth.models.ts` | SessionUser (id, email, firstName, lastName, phone, role, status, homeDistrict, homeLat, homeLng, approvalStatus?, createdAt) and RegisterPayload. SessionUser is what /auth/me returns and the ONLY identity in the app — it kills 'Welcome Jane' / 'Jane Doe Victim' / 'John Doe Administrator' rendering simultaneously. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/models/request.models.ts` | HelpRequestListItem, HelpRequestDetail (with timeline: StatusEventDto[], assignment: AssignmentDto|null, victimContact: ContactDto|null), CreateHelpRequest, AvailableRequestItem (adds distanceKm), AssignedTaskItem, RequestTypeOption, FeedbackPayload. Note every field is a scalar: no `icon: any`, no `iconBgColor`, no `timeAgo`, no pre-formatted dates. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/models/admin.models.ts` | AdminUserRow, AdminDashboard { kpis, activity: ActivityRow[], trend: TrendPoint[] }, DisasterEventRow (with derivedStatus: 'ACTIVE'|'UPCOMING'|'PAST'), CreateDisasterEvent, ShelterRow, ReportRow, VolunteerDashboard. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/models/notification.models.ts` | NotificationDto { id, type, title, body, helpRequestId: number|null, readAt: string|null, createdAt }. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/reference/kerala-districts.ts` | `export const KERALA_DISTRICTS: readonly { code: KeralaDistrict; label: string; lat: number; lng: number }[]` — 14 rows, a byte-for-byte mirror of backend/src/reference/kerala-districts.ts. This array IS the replacement for navigator.geolocation and for the external geocoder. It backs the wizard select, the profile select and the admin event form. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/reference/enum-labels.ts` | One file of Record<Enum, string> maps: REQUEST_STATUS_LABEL, URGENCY_LABEL, ROLE_LABEL, SEVERITY_LABEL, DISASTER_TYPE_LABEL, APPROVAL_LABEL, ASSIGNMENT_STATUS_LABEL. Server sends IN_PROGRESS, screens show 'In Progress'. Having exactly one place for this is what stops the six hardcoded getStatusColor()/label switches from drifting again. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/reference/icon-map.ts` | `ICON_BY_KEY: Record<string, IconDefinition>` mapping request_types.icon_key ('heartbeat','utensils','home','truck','question-circle') to the FontAwesome objects, and `CHIP_BY_COLOR_KEY: Record<string,string>` mapping color_key ('red','green','blue','purple','gray') to a Tailwind class pair. JSON cannot carry an IconDefinition — this file is the bridge, and it is why icon/iconBgColor could be removed from the data model (a 3NF before/after for the report). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/lookups/request-types.service.ts` | providedIn:'root'. Fetches GET /lookups/request-types ONCE, caches in a signal, exposes `options()` and `byId(id)`. Shared by the wizard, available-requests filter, admin all-requests filter and the report. This single service is what finally syncs the four out-of-date hardcoded <option> lists (the admin one is missing 'Rescue / Evacuation' today). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/notifications/notification.store.ts` | Root singleton. items/unread/hasUnread signals, refresh(), markRead(id), markAllRead(). Owned by the store not the Header so the count survives navigation. Polled from the Header via pollWhileVisible(15000). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/util/poll.ts` | `pollWhileVisible(intervalMs, tick)` — must be called in an injection context. setInterval + a visibilitychange listener that stops the timer when document.hidden and restarts (with an immediate tick) when it becomes visible; both torn down via inject(DestroyRef).onDestroy. Used in exactly two places: the header bell (15s) and request-detail (15s). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/util/form-errors.ts` | `showError(c: AbstractControl): boolean` (invalid && (dirty||touched)) and `applyServerFieldErrors(form, err)` which reads a 422 body's error.fields map and calls setErrors({server: msg}) + markAsTouched on each named control. Two functions, used by all five forms. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/util/time-ago.pipe.ts` | Standalone pure pipe `timeAgo`: ISO UTC string -> '15m ago' / '3h ago' / '2d ago'. Replaces the stored timeAgo strings in the old mock data. Pure, so it re-evaluates on each poll-driven signal change, which is enough. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/util/enum-label.pipe.ts` | Standalone pure pipe `enumLabel` taking a map name, e.g. {{ r.status | enumLabel:'requestStatus' }}. Keeps templates free of switch statements. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/toast.service.ts` | Root singleton. toasts signal, success/error/warning/info(text) with auto-dismiss (4s success/info, 6s warning, 8s error) and dismiss(id). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/toast-host.ts` | Inline-template standalone component <app-toast-host/>, fixed bottom-right stack, role="status" aria-live="polite". Mounted ONCE in app.html next to <router-outlet> — not in main-layout — so login/register 429 and network toasts also appear. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/confirm.service.ts` | Root singleton with a promise-based API: `await confirm.ask({ title, message, confirmLabel, danger })` resolves boolean. Holds a `request` signal and the pending resolver. Used by SOS, Cancel request, Deactivate user, Approve volunteer and Complete task. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/confirm-host.ts` | Inline-template modal rendered from confirm.request(); calls confirm.answer(true|false). Mounted once in app.html. Esc and backdrop click both answer false. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/state-panel.ts` | <app-state-panel [loading] [error] [empty] [emptyTitle] [emptyMessage] (retry)> wrapping <ng-content/>. Renders a skeleton, a red retry panel or an empty illustration; the projected content sits in a plain <div [hidden]="loading()||error()||empty()"> which must carry NO Tailwind display class (a `grid`/`flex` utility beats the [hidden] UA rule). Deliberately does NOT put <ng-content> inside an @if block. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/modal-shell.ts` | <app-modal-shell [open] [title] (closed)> with a default content slot and a [slot=footer] slot. Backdrop + centred card + Esc handling written once and reused by the volunteer status dialog, the admin assign dialog, the create-disaster-event dialog and the cancel-reason dialog. Saves roughly 3 hours of repeated modal chrome. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/initials-avatar.ts` | <app-initials-avatar [name] [size]> -> a CSS circle with initials and a deterministic background hue from a char-code hash. Replaces every https://placehold.co/... <img> in header, user-management, admin dashboard activity feed and user-profile. Those are external fetches that render as broken boxes on an offline examiner laptop. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/status-badge.ts` | <app-status-badge [status]> — one pill component for RequestStatus. Deletes four separate getStatusColor() switch functions (request-status, all-requests, assigned-tasks, disaster-management). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/ui/urgency-badge.ts` | <app-urgency-badge [urgency]> — four values now (CRITICAL added), deleting two more getUrgencyColor() switches. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/pages/forbidden/forbidden.ts` | Real 403 page at /forbidden with a 'Back to my dashboard' button using auth.homeRoute(). This is what demo step 8 lands on — it must look designed, not like a stack trace. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/core/pages/not-found/not-found.ts` | 404 page. The current '**' route redirects to auth/login, which bounces a logged-in examiner to the login screen on a typo and looks like a session bug. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/requests/request-detail/request-detail.ts` | THE NEW SCREEN. Route 'requests/:id' with a signal input id. Role-aware projection of ONE DTO: victim sees the timeline + assigned volunteer contact; volunteer sees victim contact only when detail.victimContact is non-null (the server decides, not the template); admin sees everything plus the assignment history. Retires the eight dead 'View Details' buttons. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/requests/request-detail/request-detail.html` | Header with computed reference REQ-YYYY-NNNNNN, status badge, the request_status_events timeline as a vertical rail with actor name + timeAgo, a contact card, and a role-switched action bar (victim: Cancel / Give Feedback; volunteer: Update Status; admin: Assign / Cancel). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/requests/request-detail/request-detail.facade.ts` | load(id), cancel(id, reason), poll refresh. Screen-scoped (@Injectable() in the component's providers, not providedIn:'root'). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/victim/request-status/my-requests.facade.ts` | THE CANONICAL LIST FACADE (see signalStorePattern). Server-side status filter + pagination + per-status counts from the envelope, plus cancel(). Copy this file 6 times for the other lists. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/dashboard/victim-dashboard/victim-dashboard.facade.ts` | One GET /dashboard/victim -> { activeEvent, openRequestCount, nearestShelter }, plus sos() which confirms then POSTs to the same create endpoint with requestTypeId=RESCUE, urgency=CRITICAL and the user's saved home district/lat/lng, then navigates to /requests/:id. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/volunteer/available-requests/available-requests.facade.ts` | Pool list with server-side typeId filter and sort ('urgency'|'distance'|'newest'), plus claim(id) that on 201 removes the card from the signal and navigates, and on 409 leaves the list and lets the interceptor toast 'Already accepted by Arun K.'. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/volunteer/assigned-tasks/assigned-tasks.facade.ts` | GET /assignments/mine, plus transition(assignmentId, toStatus, { progressPct, hoursLogged, notes }). Does NOT client-validate the transition order — sending ASSIGNED->COMPLETED and letting the server 400 is demo beat 14. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/volunteer/assigned-tasks/status-dialog.ts` | Reactive form inside <app-modal-shell>: a status select, a progress range input, and hoursLogged + completionNotes that become required via setValidators/updateValueAndValidity when status === 'COMPLETED'. This conditional-validator pattern is the third reactive form the developer writes and is the one to learn before the wizard. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/volunteer/volunteer-dashboard/volunteer-dashboard.facade.ts` | One GET /dashboard/volunteer -> the four KPIs. Zero writes on this page. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/admin/all-requests/all-requests.facade.ts` | Four SERVER-side filters (q, typeId, status, dateFrom) + real pagination. All four are completely unbound today. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/admin/all-requests/assign-dialog.ts` | Modal listing APPROVED volunteers with rating/completed counts; POSTs /requests/:id/assign through the SAME claim service with assignedBy set. First item on the abort list if week 3 ends behind. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/admin/user-management/user-management.facade.ts` | Debounced (300ms) server-side search via a FormControl + toSignal/valueChanges, plus approve(), setRole(), setStatus(). Surfaces the server's guardrail 409s (cannot deactivate yourself, cannot remove the last ADMIN) as toasts. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/admin/disaster-management/disaster-events.facade.ts` | List with derivedStatus straight from the server (never stored), plus create(). |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/admin/disaster-management/create-event-dialog.ts` | Reactive form in a modal: name, type, severity, district (which auto-patches centerLat/centerLng from KERALA_DISTRICTS), radiusKm, helplineNumber, startDate, endDate with an end>start cross-field validator. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/features/admin/system-reports/reports.facade.ts` | loadSummary(from,to) for the on-screen type x status cross-tab, and downloadCsv() which does responseType:'blob' + URL.createObjectURL + a synthetic <a download> click, revoking the object URL in a finally. |
| `D:/Program/Angular/Disaster Management/frontend/src/app/layout/dashboard/admin-dashboard.facade.ts` | One GET /dashboard/admin -> { kpis, activity, trend }. trend is seven { date, count } points rendered as seven divs with [style.height.%] — no Chart.js. |

---

## app.config.ts changes

## 1. `frontend/src/app/app.config.ts` — full replacement

```ts
import {
  ApplicationConfig, inject,
  provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { credentialsInterceptor } from './core/http/credentials.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { AuthStore } from './core/auth/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),   // zone stays: zoneless is CUT

    provideRouter(
      routes,
      withComponentInputBinding(),                            // :id -> input() on the component
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),

    provideHttpClient(
      withFetch(),
      withInterceptors([credentialsInterceptor, errorInterceptor]),
    ),

    // Runs BEFORE the router. Returning the promise makes every guard synchronous.
    provideAppInitializer(() => inject(AuthStore).restoreSession()),
  ],
};
```

Three things must be true or the demo breaks:
- `withComponentInputBinding()` — without it `/requests/:id` and `/victim/feedback/:requestId` receive `undefined`.
- `provideAppInitializer` must return the **promise**. If it returns `void`, guards run before `/auth/me` resolves and every hard refresh bounces a logged-in user to login mid-viva.
- `restoreSession()` must never reject. It catches its own 401 and sets `_user = null`.

## 2. `frontend/src/app/app.routes.ts` — full replacement (also the bundle fix)

```ts
import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './core/auth/auth.store';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./layout/auth-layout/auth-layout').then(m => m.AuthLayout),
    children: [
      { path: 'login',    loadComponent: () => import('./pages/login/login').then(m => m.Login) },
      { path: 'register', loadComponent: () => import('./pages/registration/registration').then(m => m.Registration) },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then(m => m.MainLayout),
    children: [
      // role-based landing (Angular 18+ function redirect, runs in an injection context)
      { path: '', pathMatch: 'full', redirectTo: () => inject(AuthStore).homeRoute() },

      { path: 'profile',      loadComponent: () => import('./pages/user-profile/user-profile').then(m => m.UserProfile) },
      { path: 'requests/:id', loadComponent: () => import('./features/requests/request-detail/request-detail').then(m => m.RequestDetail) },
      { path: 'forbidden',    loadComponent: () => import('./core/pages/forbidden/forbidden').then(m => m.Forbidden) },

      // VICTIM
      { path: 'victim/dashboard',      canActivate: [roleGuard('VICTIM')], loadComponent: () => import('./features/dashboard/victim-dashboard/victim-dashboard').then(m => m.VictimDashboard) },
      { path: 'victim/submit-request', canActivate: [roleGuard('VICTIM')], loadComponent: () => import('./features/victim/request/request').then(m => m.Request) },
      { path: 'victim/my-requests',    canActivate: [roleGuard('VICTIM')], loadComponent: () => import('./features/victim/request-status/request-status').then(m => m.RequestStatus) },
      { path: 'victim/feedback/:requestId', canActivate: [roleGuard('VICTIM')], loadComponent: () => import('./features/victim/feedback/feedback').then(m => m.Feedback) },

      // VOLUNTEER
      { path: 'volunteer/dashboard',       canActivate: [roleGuard('VOLUNTEER')], loadComponent: () => import('./features/volunteer/volunteer-dashboard/volunteer-dashboard').then(m => m.VolunteerDashboard) },
      { path: 'volunteer/available-tasks', canActivate: [roleGuard('VOLUNTEER')], loadComponent: () => import('./features/volunteer/available-requests/available-requests').then(m => m.AvailableRequests) },
      { path: 'volunteer/my-tasks',        canActivate: [roleGuard('VOLUNTEER')], loadComponent: () => import('./features/volunteer/assigned-tasks/assigned-tasks').then(m => m.AssignedTasks) },

      // ADMIN
      { path: 'dashboard',               canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./layout/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'admin/user-management',   canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./features/admin/user-management/user-management').then(m => m.UserManagement) },
      { path: 'admin/all-requests',      canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./features/admin/all-requests/all-requests').then(m => m.AllRequests) },
      { path: 'admin/disaster-management', canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./features/admin/disaster-management/disaster-management').then(m => m.DisasterManagement) },
      { path: 'admin/system-reports',    canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./features/admin/system-reports/system-reports').then(m => m.SystemReports) },

      { path: '**', loadComponent: () => import('./core/pages/not-found/not-found').then(m => m.NotFound) },
    ],
  },
];
```

Changes vs today: every route is `loadComponent`; the duplicate empty-path redirect is gone; `'**'` no longer redirects to `auth/login`; `victim/feedback` is now parameterised; `requests/:id` exists; `/dashboard` is admin-only. Also note the top-level `'**'` was removed — the unauthenticated 404 case is covered because `authGuard` on the parent fires first.

## 3. `frontend/src/app/app.html`

```html
<router-outlet />
<app-toast-host />
<app-confirm-host />
```
Hosts go here, **not** in main-layout, so login/register toasts work too. Add the two imports to `App` and delete the unused `Header`/`Footer`/`Sidebar` imports that `app.ts` currently declares but never uses.

## 4. `frontend/src/index.html`

- `<title>DRMS — Disaster Relief Management System</title>`
- Delete the Material Icons `<link>` (FontAwesome-only app).
- **Delete the Roboto Google Fonts `<link>` too** and use a system font stack in `styles.scss`. On an offline exam-hall laptop that link blocks first paint for the browser's DNS timeout.

## 5. `frontend/src/styles.scss` — full replacement

```scss
@use "tailwindcss";

html, body { height: 100%; }
body {
  margin: 0;
  background-color: #f3f4f6;
  color: #111827;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
```
Deletes `@use '@angular/material'`, the whole `mat.theme()` block, the `--mat-sys-*` variable dependency and the now-dead `@custom-variant dark` line.

## 6. `frontend/angular.json`

- `architect.serve.options.proxyConfig = "proxy.conf.json"` (the `serve` target currently has no `options` key at all — add one).
- After the refactor lands, tighten the budget so it becomes a regression test: `maximumWarning: "400kB"`, `maximumError: "500kB"`.

## 7. `frontend/package.json`

`npm uninstall @angular/material @angular/cdk autoprefixer @fortawesome/free-brands-svg-icons` (the brands package exists only for the `faGoogle` button being deleted). Add `"proxy": ...` is not needed. Add script `"start": "ng serve --proxy-config proxy.conf.json"` as belt-and-braces alongside the angular.json setting.

---

## Auth layer

## `core/auth/auth.store.ts`

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API } from '../http/api.config';
import { SKIP_ERROR_HANDLER } from '../http/error.interceptor';
import { Role } from '../models/enums';
import { RegisterPayload, SessionUser } from '../models/auth.models';

const QUIET = () => ({ context: new HttpContext().set(SKIP_ERROR_HANDLER, true) });

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private http = inject(HttpClient);

  private readonly _user  = signal<SessionUser | null>(null);
  private readonly _ready = signal(false);

  readonly user  = this._user.asReadonly();
  readonly ready = this._ready.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role            = computed<Role | null>(() => this._user()?.role ?? null);
  readonly fullName        = computed(() => {
    const u = this._user(); return u ? `${u.firstName} ${u.lastName}` : '';
  });
  readonly initials = computed(() => {
    const u = this._user(); return u ? `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase() : '?';
  });
  readonly isApprovedVolunteer = computed(() => this._user()?.approvalStatus === 'APPROVED');

  homeRoute(): string {
    switch (this._user()?.role) {
      case 'ADMIN':     return '/dashboard';
      case 'VOLUNTEER': return '/volunteer/dashboard';
      case 'VICTIM':    return '/victim/dashboard';
      default:          return '/auth/login';
    }
  }

  /** Called by provideAppInitializer. MUST NOT reject. */
  async restoreSession(): Promise<void> {
    try {
      this._user.set(await firstValueFrom(this.http.get<SessionUser>(`${API}/auth/me`, QUIET())));
    } catch {
      this._user.set(null);
    } finally {
      this._ready.set(true);
    }
  }

  async login(body: { email: string; password: string }): Promise<void> {
    this._user.set(await firstValueFrom(
      this.http.post<SessionUser>(`${API}/auth/login`, body, QUIET())));
  }

  async register(body: RegisterPayload): Promise<void> {
    this._user.set(await firstValueFrom(
      this.http.post<SessionUser>(`${API}/auth/register`, body, QUIET())));
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(this.http.post(`${API}/auth/logout`, {})); }
    finally { this._user.set(null); }
  }

  clear(): void { this._user.set(null); }

  patchProfile(p: Pick<SessionUser, 'firstName' | 'lastName' | 'phone'>): void {
    this._user.update(u => (u ? { ...u, ...p } : u));
  }
}
```

`QUIET()` on `/auth/me`, `/auth/login`, `/auth/register` is load-bearing: without it, the boot-time 401 from `/auth/me` makes the error interceptor call `router.navigate()` during `APP_INITIALIZER`, before the router has a configuration — you get an opaque bootstrap crash. And a 401 from `login` must render as red text under the form, not as a redirect to the page you are already on.

## `core/http/credentials.interceptor.ts`

```ts
import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  return next(req.clone({
    withCredentials: true,
    setHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
  }));
};
```
This is the project's CSRF answer. Double-submit tokens are cut by decision; the defence is SameSite=Lax + same-origin + non-GET mutations, and this custom header is the free third layer: a `<form>` on evil.com cannot set it, and an `fetch()` that tries triggers a CORS preflight the server (which has no CORS middleware at all) will fail. Say exactly that in the viva.

## `core/http/error.interceptor.ts`

```ts
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../ui/toast.service';

export const SKIP_ERROR_HANDLER = new HttpContextToken<boolean>(() => false);

export function serverMessage(e: unknown): string | null {
  const err = e as HttpErrorResponse;
  return (err?.error?.error?.message as string | undefined) ?? null;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast  = inject(ToastService);
  const auth   = inject(AuthStore);

  return next(req).pipe(catchError((e: HttpErrorResponse) => {
    if (req.context.get(SKIP_ERROR_HANDLER)) return throwError(() => e);
    const msg = serverMessage(e);

    switch (e.status) {
      case 0:
        toast.error('Cannot reach the server. Is the API running on port 3000?'); break;
      case 401:
        auth.clear();
        void router.navigate(['/auth/login'], { queryParams: { returnUrl: router.url } });
        break;
      case 403:
        // GET = you navigated somewhere you may not see -> a real page.
        // non-GET = you tried to do something you may not do -> a toast, stay put.
        if (req.method === 'GET') void router.navigate(['/forbidden']);
        else toast.error(msg ?? 'You are not allowed to do that.');
        break;
      case 404: toast.error(msg ?? 'That item no longer exists.'); break;
      case 409: toast.warning(msg ?? 'Someone else got there first.'); break;
      case 422: break;                       // the FORM owns field errors, not a toast
      case 429: toast.error(msg ?? 'Too many attempts. Please wait a minute.'); break;
      default:  if (e.status >= 500) toast.error('Something went wrong on the server.');
    }
    return throwError(() => e);
  }));
};
```

The 403 GET/non-GET split is what makes demo step 8 (paste another victim's request id -> Forbidden page) and demo step 12 / the unapproved-volunteer claim (-> toast, card stays) both correct from one rule.

## `core/auth/auth.guards.ts`

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { Role } from '../models/enums';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore), router = inject(Router);
  return auth.isAuthenticated()
    ? true
    : router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthStore), router = inject(Router);
  return auth.isAuthenticated() ? router.parseUrl(auth.homeRoute()) : true;
};

export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthStore), router = inject(Router);
    if (!auth.isAuthenticated())
      return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
    const role = auth.role();
    return role !== null && roles.includes(role) ? true : router.parseUrl('/forbidden');
  };
}
```

All three are synchronous. They can be, and only because `provideAppInitializer` already awaited `/auth/me`.

## Logout that actually navigates

`sidebar.ts` currently has `logout() { console.log('Logging out...'); }` and the header has an `<a href="#">Sign Out</a>`. Both become:

```ts
async logout(): Promise<void> {
  await this.auth.logout();
  await this.router.navigateByUrl('/auth/login');
}
```
`navigateByUrl` after `auth.logout()` resolves, not before — otherwise `guestGuard` sees a still-populated store and bounces you straight back to the dashboard.

## Role-filtered sidebar

Delete the entire `NavigationEnd` subscription, `updateActiveState()`, `isActive` bookkeeping and `navigateTo()` (~60 lines) and use `routerLink` + `routerLinkActive` in the template. Replace the one flat `menuItems` array with three constants and one computed:

```ts
readonly menu = computed<MenuSection[]>(() => {
  switch (this.auth.role()) {
    case 'ADMIN':     return ADMIN_MENU;
    case 'VOLUNTEER': return VOLUNTEER_MENU;
    case 'VICTIM':    return VICTIM_MENU;
    default:          return [];
  }
});
```
Say the sentence at demo step 8: *the hidden menu is UX, the guard is a second layer of UX, and the server is the enforcement.*

## One identity everywhere

`header.html` hardcodes `John Doe / Administrator` and a placehold.co avatar; `victim-dashboard.html` says `Welcome, Jane`; `user-profile.ts` mocks `Jane Doe / Victim`. All three become `auth.fullName()`, `auth.role() | enumLabel:'role'` and `<app-initials-avatar [name]="auth.fullName()"/>`. Delete `services/theme.ts` and `services/theme.spec.ts` (staged, never committed) and the `faSun`/`faMoon` imports plus the `Theme` injection in `header.ts` — dark mode is cut and the service is currently unreachable anyway.

---

## Signal store pattern — copy this for every feature


## The pattern: one screen-scoped `@Injectable()` facade, signals only, no NgRx, no RxJS state

Copy this file for every list screen. Five things change each time: the DTO type, the URL, the extra filter signals, the command methods, and the class name. **Nothing else.**

### `features/victim/request-status/my-requests.facade.ts`

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API } from '../../../core/http/api.config';
import { ListEnvelope } from '../../../core/models/api.models';
import { HelpRequestListItem } from '../../../core/models/request.models';
import { RequestStatus } from '../../../core/models/enums';
import { ToastService } from '../../../core/ui/toast.service';

type StatusFilter = RequestStatus | 'ALL';

@Injectable()                    // NOT providedIn:'root' — see note 1
export class MyRequestsFacade {
  private http  = inject(HttpClient);
  private toast = inject(ToastService);

  readonly pageSize = 5;

  // 1 ── private writable state ────────────────────────────────────────
  private readonly _items   = signal<HelpRequestListItem[]>([]);
  private readonly _counts  = signal<Record<string, number>>({});
  private readonly _total   = signal(0);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);
  private readonly _status  = signal<StatusFilter>('ALL');
  private readonly _page    = signal(1);

  // 2 ── public read-only surface (templates can never write state) ────
  readonly items   = this._items.asReadonly();
  readonly counts  = this._counts.asReadonly();
  readonly total   = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error   = this._error.asReadonly();
  readonly status  = this._status.asReadonly();
  readonly page    = this._page.asReadonly();

  // 3 ── derived state ─────────────────────────────────────────────────
  readonly isEmpty    = computed(() => !this._loading() && this._error() === null && this._items().length === 0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this._total() / this.pageSize)));
  readonly canPrev    = computed(() => this._page() > 1);
  readonly canNext    = computed(() => this._page() < this.totalPages());

  // 4 ── commands (async/await, never .subscribe in a component) ───────
  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    let params = new HttpParams()
      .set('page', this._page())
      .set('pageSize', this.pageSize);
    if (this._status() !== 'ALL') params = params.set('status', this._status());

    try {
      const res = await firstValueFrom(
        this.http.get<ListEnvelope<HelpRequestListItem>>(`${API}/requests/mine`, { params }));
      this._items.set(res.items);
      this._total.set(res.total);
      this._counts.set(res.counts);
    } catch {
      this._error.set('Could not load your requests. Check the server is running, then retry.');
    } finally {
      this._loading.set(false);
    }
  }

  setStatus(s: StatusFilter): void { this._status.set(s); this._page.set(1); void this.load(); }
  nextPage(): void { if (this.canNext()) { this._page.update(p => p + 1); void this.load(); } }
  prevPage(): void { if (this.canPrev()) { this._page.update(p => p - 1); void this.load(); } }

  async cancel(id: number, reason: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API}/requests/${id}/cancel`, { reason }));
      this.toast.success('Request cancelled.');
      await this.load();                           // re-read: counts change too
    } catch { /* interceptor already toasted; keep the list as-is */ }
  }
}
```

### The component that uses it

```ts
@Component({
  selector: 'app-request-status',
  imports: [RouterLink, StatePanel, StatusBadge, TimeAgoPipe, EnumLabelPipe],
  providers: [MyRequestsFacade],                   // note 1
  templateUrl: './request-status.html',
  styleUrl: './request-status.scss',
})
export class RequestStatus {
  readonly f = inject(MyRequestsFacade);
  private confirm = inject(ConfirmService);

  readonly filters = ['ALL','SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'] as const;

  constructor() { void this.f.load(); }            // note 2

  async onCancel(id: number, reference: string): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Cancel this request?',
      message: `${reference} will be closed. You cannot undo this.`,
      confirmLabel: 'Cancel request',
      danger: true,
    });
    if (ok) await this.f.cancel(id, 'Cancelled by requester');
  }
}
```

### The template

```html
<div class="flex flex-wrap gap-2 mb-4">
  @for (s of filters; track s) {
    <button type="button" (click)="f.setStatus(s)"
            class="px-3 py-1.5 rounded-full text-sm border"
            [class.bg-blue-600]="f.status() === s"
            [class.text-white]="f.status() === s"
            [class.border-blue-600]="f.status() === s">
      {{ s | enumLabel:'requestStatus' }}
      <span class="ml-1 opacity-75">{{ f.counts()[s] ?? 0 }}</span>
    </button>
  }
</div>

<app-state-panel
  [loading]="f.loading()" [error]="f.error()" [empty]="f.isEmpty()"
  emptyTitle="No requests yet"
  emptyMessage="When you submit a help request it will appear here."
  (retry)="f.load()">

  <table class="w-full text-sm text-left text-gray-500">
    <tbody>
      @for (r of f.items(); track r.id) {
        <tr class="bg-white border-b hover:bg-gray-50">
          <td class="px-6 py-4 font-medium text-gray-900">{{ r.reference }}</td>
          <td class="px-6 py-4">{{ r.typeLabel }}</td>
          <td class="px-6 py-4"><app-status-badge [status]="r.status" /></td>
          <td class="px-6 py-4">{{ r.submittedAt | timeAgo }}</td>
          <td class="px-6 py-4 text-right">
            <a [routerLink]="['/requests', r.id]" class="text-blue-600 hover:underline">View Details</a>
            @if (r.status === 'SUBMITTED') {
              <button type="button" (click)="onCancel(r.id, r.reference)"
                      class="ml-3 text-red-600 hover:underline">Cancel</button>
            }
            @if (r.status === 'COMPLETED' && !r.hasFeedback) {
              <a [routerLink]="['/victim/feedback', r.id]" class="ml-3 text-green-600 hover:underline">Give Feedback</a>
            }
          </td>
        </tr>
      }
    </tbody>
  </table>
</app-state-panel>

<div class="flex items-center justify-between mt-4 text-sm">
  <span>Page {{ f.page() }} of {{ f.totalPages() }} · {{ f.total() }} requests</span>
  <div class="space-x-2">
    <button type="button" (click)="f.prevPage()" [disabled]="!f.canPrev()" class="px-3 py-1.5 border rounded disabled:opacity-40">Previous</button>
    <button type="button" (click)="f.nextPage()" [disabled]="!f.canNext()" class="px-3 py-1.5 border rounded disabled:opacity-40">Next</button>
  </div>
</div>
```

### The five notes that make this work

1. **`@Injectable()` + `providers: [Facade]` on the component, not `providedIn: 'root'`.** The facade lives and dies with the screen, so filters reset on navigation and there is no stale list flashing when you come back. Only four things are root singletons: `AuthStore`, `ToastService`, `ConfirmService`, `NotificationStore` (+ `RequestTypesService`, which caches five rows).
2. **Kick off the load in the constructor, not `ngOnInit`.** The component is created inside an injection context; `void this.f.load()` in the constructor is one line and you never touch a lifecycle interface again. The `void` is deliberate — it tells the reader (and the linter) you are intentionally not awaiting.
3. **Components never call `.subscribe()`.** `firstValueFrom` inside the facade; `await` in the component. There is exactly one `.subscribe()` in the whole frontend — the debounced search `valueChanges` in user-management — and one `.pipe(takeUntilDestroyed())` in the wizard draft saver.
4. **`load()` never throws.** Failure is state (`_error`), not an exception. That is what lets `<app-state-panel>` be the single error UI.
5. **After any mutation, re-`load()`.** Do not patch the local array. The per-status counts, the total and the pagination all change server-side, and a locally-spliced array desyncs them in a way an examiner will spot.

### The three variants you will write

- **Detail facade** (`request-detail.facade.ts`): same shape, `_item = signal<T|null>(null)` instead of `_items`, `load(id: number)`.
- **Aggregate facade** (the three dashboards): same shape, one GET, no filters, no pagination — about 30 lines.
- **Polled facade** (header bell, request-detail): identical, plus `pollWhileVisible(15_000, () => void this.refresh())` called in the *component* constructor so the timer is tied to the view, not the service.

```ts
// core/util/poll.ts
import { DestroyRef, inject } from '@angular/core';

export function pollWhileVisible(intervalMs: number, tick: () => void): void {
  const destroyRef = inject(DestroyRef);
  let handle: ReturnType<typeof setInterval> | null = null;
  const start = () => { if (handle === null) { tick(); handle = setInterval(tick, intervalMs); } };
  const stop  = () => { if (handle !== null) { clearInterval(handle); handle = null; } };
  const onVisibility = () => (document.hidden ? stop() : start());

  document.addEventListener('visibilitychange', onVisibility);
  start();
  destroyRef.onDestroy(() => { stop(); document.removeEventListener('visibilitychange', onVisibility); });
}
```
`start()` ticks immediately, so coming back to a tab refreshes instantly rather than after 15 more seconds. Always pair the poll with a visible **Refresh** button and a small "Live" dot — demo step 13 depends on never standing in silence.

---

## Typed reactive form pattern


`ReactiveFormsModule` is imported by **zero** files today. Learn it in this order — login, registration, status dialog, then the wizard. Doing the wizard first is how a week disappears.

---

## A. Login — the two-field template to copy

### `pages/login/login.ts`

```ts
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
import { AuthStore } from '../../core/auth/auth.store';
import { serverMessage } from '../../core/http/error.interceptor';
import { showError } from '../../core/util/form-errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FontAwesomeModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb     = inject(NonNullableFormBuilder);
  private auth   = inject(AuthStore);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  faEnvelope = faEnvelope;
  faLock     = faLock;

  readonly submitting  = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  // getters keep the template short AND satisfy strictTemplates
  get email()    { return this.form.controls.email; }
  get password() { return this.form.controls.password; }

  show(c: AbstractControl): boolean { return showError(c); }

  async submit(): Promise<void> {
    this.serverError.set(null);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.submitting.set(true);
    try {
      await this.auth.login(this.form.getRawValue());
      const back = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(back ?? this.auth.homeRoute());
    } catch (e) {
      this.serverError.set(serverMessage(e) ?? 'Invalid email or password.');
    } finally {
      this.submitting.set(false);
    }
  }
}
```

### `pages/login/login.html` (the form block only — the two-panel layout stays)

```html
<form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6" novalidate>

  @if (serverError(); as msg) {
    <div role="alert" class="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
      {{ msg }}
    </div>
  }

  <div>
    <label for="email" class="block text-sm font-medium text-gray-700">Email Address</label>
    <div class="mt-1 relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <fa-icon [icon]="faEnvelope" />
      </div>
      <input id="email" type="email" formControlName="email" autocomplete="email"
             placeholder="you@example.com"
             class="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
             [class.border-gray-300]="!show(email)" [class.border-red-500]="show(email)">
    </div>
    @if (show(email)) {
      <p class="mt-1 text-xs text-red-600">
        @if (email.hasError('required'))   { Email is required. }
        @else if (email.hasError('email')) { Enter a valid email address. }
        @else if (email.hasError('server')){ {{ email.getError('server') }} }
      </p>
    }
  </div>

  <!-- password block: identical shape -->

  <button type="submit" [disabled]="submitting()"
          class="w-full py-3 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
    {{ submitting() ? 'Signing in…' : 'Sign In' }}
  </button>
</form>

<p class="mt-8 text-center text-sm text-gray-600">
  Not a member yet? <a routerLink="/auth/register" class="font-medium text-blue-600">Sign up now</a>
</p>
```

**Deletions in this file:** the whole "Or continue with" separator, the **Sign in with Google** button, the **Forgot your password?** link, and the `faGoogle` import. Leaving any of them is a question you cannot answer.

**Five traps, all of which bite once:**
1. `action="#"` must go. That attribute is why the current form does a native GET and reloads the SPA.
2. `novalidate` on `<form>`, or Chrome's own validation bubble fires before your handler and the demo shows a browser tooltip instead of your styled error.
3. `ReactiveFormsModule` must be in the component's `imports` array. Standalone components get nothing for free.
4. `NonNullableFormBuilder`, not `FormBuilder` — otherwise every control is `string | null` and `getRawValue()` does not match your DTO type.
5. Keep `id`/`for` pairs, drop every `name=` attribute. `formControlName` replaces it.

---

## B. Registration — cross-field validator + role radio + terms

```ts
// core/util/validators.ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const passwordsMatch: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const pw = g.get('password')?.value as string | undefined;
  const cf = g.get('confirmPassword')?.value as string | undefined;
  return pw && cf && pw !== cf ? { passwordMismatch: true } : null;
};
```

```ts
readonly form = this.fb.group({
  role:            ['VICTIM' as 'VICTIM' | 'VOLUNTEER', Validators.required],
  firstName:       ['', [Validators.required, Validators.maxLength(60)]],
  lastName:        ['', [Validators.required, Validators.maxLength(60)]],
  email:           ['', [Validators.required, Validators.email, Validators.maxLength(191)]],
  phone:           ['', [Validators.pattern(/^[0-9+\-\s]{10,20}$/)]],
  homeDistrict:    ['' as KeralaDistrict | '', Validators.required],
  password:        ['', [Validators.required, Validators.minLength(8)]],
  confirmPassword: ['', Validators.required],
  acceptTerms:     [false, Validators.requiredTrue],
}, { validators: passwordsMatch });          // <- group-level, not control-level
```

```html
<div class="flex gap-6">
  <label class="flex items-center gap-2">
    <input type="radio" formControlName="role" value="VICTIM"> I need help
  </label>
  <label class="flex items-center gap-2">
    <input type="radio" formControlName="role" value="VOLUNTEER"> I want to volunteer
  </label>
</div>

@if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) {
  <p class="mt-1 text-xs text-red-600">Passwords do not match.</p>
}

<label class="flex items-start gap-2 text-sm">
  <input type="checkbox" formControlName="acceptTerms" class="mt-1">
  <span>I agree to the Terms of Service and the Privacy Notice.</span>
</label>
```

Submit sends `termsVersion: '2026-01-v1'`; the server writes `users.terms_accepted_at`. Demo step 3 mistypes the confirm field deliberately so `passwordMismatch` fires on screen, then fixes it and shows the new `users` row in Adminer.

---

## C. The 3-step wizard — ONE typed FormGroup with three nested groups

### `features/victim/request/request.ts`

```ts
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { API } from '../../../core/http/api.config';
import { KERALA_DISTRICTS } from '../../../core/reference/kerala-districts';
import { RequestTypesService } from '../../../core/lookups/request-types.service';
import { ToastService } from '../../../core/ui/toast.service';
import { applyServerFieldErrors, showError } from '../../../core/util/form-errors';
import { KeralaDistrict, Urgency } from '../../../core/models/enums';

type Step = 1 | 2 | 3;
const DRAFT_KEY = 'drms.requestDraft.v1';

@Component({
  selector: 'app-request',
  imports: [ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './request.html',
  styleUrl: './request.scss',
})
export class Request {
  private fb     = inject(NonNullableFormBuilder);
  private http   = inject(HttpClient);
  private router = inject(Router);
  private toast  = inject(ToastService);
  readonly types = inject(RequestTypesService);

  readonly districts = KERALA_DISTRICTS;
  readonly urgencies: readonly Urgency[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  readonly step       = signal<Step>(1);
  readonly submitting = signal(false);
  readonly showError  = showError;

  readonly form = this.fb.group({
    details: this.fb.group({
      requestTypeId: [0, [Validators.required, Validators.min(1)]],
      urgency:       ['MEDIUM' as Urgency, Validators.required],
    }),
    location: this.fb.group({
      district:     ['' as KeralaDistrict | '', Validators.required],
      locationText: ['', [Validators.required, Validators.maxLength(200)]],
      peopleCount:  [1, [Validators.required, Validators.min(1), Validators.max(999)]],
    }),
    describe: this.fb.group({
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
      contact:     ['', Validators.maxLength(191)],
    }),
  });

  get details()  { return this.form.controls.details; }
  get location() { return this.form.controls.location; }
  get describe() { return this.form.controls.describe; }
  private groupFor(s: Step) { return s === 1 ? this.details : s === 2 ? this.location : this.describe; }

  constructor() {
    void this.types.ensureLoaded();

    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw !== null) {
      try { this.form.patchValue(JSON.parse(raw)); }
      catch { sessionStorage.removeItem(DRAFT_KEY); }
    }

    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(v => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v)));
  }

  /** THIS is the four lines that make "Next" actually block. */
  next(): void {
    const g = this.groupFor(this.step());
    if (g.invalid) { g.markAllAsTouched(); return; }
    this.step.update(s => (s < 3 ? s + 1 : s) as Step);
  }
  back(): void { this.step.update(s => (s > 1 ? s - 1 : s) as Step); }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.step.set(this.details.invalid ? 1 : this.location.invalid ? 2 : 3);
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    const contact = v.describe.contact.trim();

    try {
      const created = await firstValueFrom(this.http.post<{ id: number; reference: string }>(
        `${API}/requests`, {
          requestTypeId: v.details.requestTypeId,
          urgency:       v.details.urgency,
          district:      v.location.district,
          locationText:  v.location.locationText.trim(),
          peopleCount:   v.location.peopleCount,
          description:   v.describe.description.trim(),
          contactPhone:  contact.includes('@') ? null : (contact || null),
          contactEmail:  contact.includes('@') ? contact : null,
        }));
      sessionStorage.removeItem(DRAFT_KEY);
      this.toast.success(`Request ${created.reference} submitted.`);
      await this.router.navigate(['/requests', created.id]);
    } catch (e) {
      applyServerFieldErrors(this.form, e);     // 422 -> per-control 'server' error
      this.submitting.set(false);               // stay on the form; no toast (interceptor skips 422)
    }
  }
}
```

### `features/victim/request/request.html` — the parts that change

Keep the existing stepper markup verbatim; only swap `currentStep` for `step()`.

```html
<form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6" novalidate>

  @if (step() === 1) {
    <div formGroupName="details" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label for="requestTypeId" class="block text-sm font-medium text-gray-700">Type of Assistance Needed</label>
        <select id="requestTypeId" formControlName="requestTypeId"
                class="mt-1 block w-full py-2.5 border-gray-300 rounded-md">
          <option [ngValue]="0" disabled>-- Please select an option --</option>
          @for (t of types.options(); track t.id) {
            <option [ngValue]="t.id">{{ t.label }}</option>
          }
        </select>
        @if (showError(details.controls.requestTypeId)) {
          <p class="mt-1 text-xs text-red-600">Please choose the type of help you need.</p>
        }
      </div>
      <div>
        <label for="urgency" class="block text-sm font-medium text-gray-700">Urgency Level</label>
        <select id="urgency" formControlName="urgency" class="mt-1 block w-full py-2.5 border-gray-300 rounded-md">
          @for (u of urgencies; track u) { <option [ngValue]="u">{{ u | enumLabel:'urgency' }}</option> }
        </select>
      </div>
    </div>
  }

  @if (step() === 2) {
    <div formGroupName="location" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label for="district" class="block text-sm font-medium text-gray-700">District</label>
        <select id="district" formControlName="district" class="mt-1 block w-full py-2.5 border-gray-300 rounded-md">
          <option value="" disabled>-- Select your district --</option>
          @for (d of districts; track d.code) { <option [ngValue]="d.code">{{ d.label }}</option> }
        </select>
        @if (showError(location.controls.district)) {
          <p class="mt-1 text-xs text-red-600">District is required.</p>
        }
      </div>
      <div>
        <label for="locationText" class="block text-sm font-medium text-gray-700">Nearest Landmark</label>
        <input id="locationText" type="text" formControlName="locationText"
               placeholder="e.g. near Aluva Metro Station"
               class="mt-1 w-full px-4 py-2.5 border border-gray-300 rounded-lg">
      </div>
      <div>
        <label for="peopleCount" class="block text-sm font-medium text-gray-700">Number of People Needing Help</label>
        <input id="peopleCount" type="number" min="1" formControlName="peopleCount"
               class="mt-1 w-full px-4 py-2.5 border border-gray-300 rounded-lg">
        @if (showError(location.controls.peopleCount)) {
          <p class="mt-1 text-xs text-red-600">At least one person must need help.</p>
        }
      </div>
    </div>
  }

  @if (step() === 3) {
    <div formGroupName="describe">
      <label for="description" class="block text-sm font-medium text-gray-700">Detailed Description</label>
      <textarea id="description" rows="5" formControlName="description"
                class="mt-1 w-full p-3 border border-gray-300 rounded-lg"></textarea>
      <p class="mt-1 text-xs"
         [class.text-red-600]="showError(describe.controls.description)"
         [class.text-gray-500]="!showError(describe.controls.description)">
        {{ describe.controls.description.value.length }} / 2000 — at least 10 characters.
      </p>

      <label for="contact" class="block text-sm font-medium text-gray-700 mt-6">Safe Contact Number or Email (Optional)</label>
      <input id="contact" type="text" formControlName="contact"
             class="mt-1 w-full px-4 py-2.5 border border-gray-300 rounded-lg">
    </div>
  }

  <div class="pt-4 flex justify-between">
    @if (step() > 1) {
      <button type="button" (click)="back()" class="bg-gray-200 py-2 px-6 rounded-lg">Previous</button>
    } @else { <span></span> }

    @if (step() < 3) {
      <button type="button" (click)="next()" class="bg-blue-600 text-white py-2 px-6 rounded-lg">Next</button>
    } @else {
      <button type="submit" [disabled]="submitting()"
              class="bg-green-600 text-white py-2 px-6 rounded-lg disabled:opacity-60">
        {{ submitting() ? 'Submitting…' : 'Submit Request' }}
      </button>
    }
  </div>
</form>
```

**Wizard-specific traps:**
- `<option [ngValue]="t.id">` — **never** `value="{{t.id}}"`. With `value` the control receives the string `"3"` and the backend Zod `z.number()` rejects it with a 422 you will spend an hour chasing. `[ngValue]` preserves the number.
- `formGroupName="details"` must be on an element **inside** `[formGroup]="form"`. Putting it on the `<form>` itself is a runtime error.
- Per-step validation lives in `next()`, not in the template. The `<button>` stays enabled so the user gets a red message when they click — an always-disabled Next with no explanation is worse UX and is invisible on a projector.
- `takeUntilDestroyed()` must be called in an injection context, i.e. in the constructor field initialiser or constructor body. Inside `ngOnInit` it throws.
- `submitting` disables the button, which is the project's whole idempotency story (the `idempotency_keys` table was cut).

## D. `applyServerFieldErrors`

```ts
// core/util/form-errors.ts
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';

export function showError(c: AbstractControl): boolean {
  return c.invalid && (c.dirty || c.touched);
}

export function applyServerFieldErrors(form: FormGroup, err: unknown): void {
  const e = err as HttpErrorResponse;
  if (e?.status !== 422) return;
  const fields = (e.error?.error?.fields ?? {}) as Record<string, string>;
  for (const [path, message] of Object.entries(fields)) {
    const c = form.get(path);
    if (c === null) continue;
    c.setErrors({ ...(c.errors ?? {}), server: message });
    c.markAsTouched();
  }
}
```
Backend Zod issue paths must be emitted dot-joined (`"location.peopleCount"`) so `form.get(path)` resolves straight into the nested group. That is one `issue.path.join('.')` in the Express error mapper and it is what makes the frontend/backend validation loop close with zero per-field wiring.

---

## Shared components to build once

- core/ui/state-panel.ts — <app-state-panel [loading] [error] [empty] [emptyTitle] [emptyMessage] (retry)> wrapping <ng-content/>. Three states plus a Retry button, written once, used on all 12 data screens. IMPLEMENTATION RULE: the projected content sits in a plain <div [hidden]="loading()||error()||empty()"> that carries NO Tailwind display utility (a `grid` or `flex` class beats the [hidden] user-agent rule and the skeleton and the table render on top of each other). Deliberately does NOT nest <ng-content> inside an @if block.
- core/ui/toast.service.ts + core/ui/toast-host.ts — signal-backed toast queue (success 4s / info 4s / warning 6s / error 8s, manual dismiss). <app-toast-host/> mounted ONCE in app.html beside <router-outlet>, not in main-layout, so a 429 on the login screen is also visible. role="status" aria-live="polite", fixed bottom-right, max 3 stacked.
- core/ui/confirm.service.ts + core/ui/confirm-host.ts — promise API: `if (await confirm.ask({title, message, confirmLabel, danger: true})) { ... }`. One signal holds the pending request, one closure holds the resolver. Backdrop click and Esc both resolve false. Consumers: the SOS button, Cancel Request, Deactivate User, Approve Volunteer, and Complete Task. Replaces window.confirm(), which renders as an ugly Chrome dialog with the origin in it on a projector.
- core/ui/modal-shell.ts — <app-modal-shell [open] [title] (closed)> with a default slot and a footer slot. Backdrop, centred card, close button, Esc handling and body-scroll-lock written once. Reused by the volunteer status dialog, the admin assign dialog, the create-disaster-event dialog and the cancel-reason dialog. Skipping this means writing the same 25 lines of modal chrome four times, which is roughly three hours.
- core/ui/initials-avatar.ts — <app-initials-avatar [name] [size]>. A CSS circle with initials and a deterministic hue from a char-code hash. Replaces every https://placehold.co/... <img> in header.html, user-management.html, dashboard.html (activity feed) and user-profile.html. Those are external network fetches that render as broken-image boxes on an offline examiner laptop — this is the highest-value 20 minutes in the polish sweep.
- core/ui/status-badge.ts — <app-status-badge [status]> for the five RequestStatus values. Deletes four duplicated getStatusColor() switch functions (request-status.ts, all-requests.ts, assigned-tasks.ts, disaster-management.ts) which currently disagree about 'Pending Confirmation'.
- core/ui/urgency-badge.ts — <app-urgency-badge [urgency]> for LOW|MEDIUM|HIGH|CRITICAL. Deletes two more getUrgencyColor() switches and is where CRITICAL (missing from the volunteer screens today) finally gets a colour.
- core/util/time-ago.pipe.ts — standalone pure pipe turning an ISO UTC string into '15m ago' / '3h ago' / '12 Sep'. Replaces the stored timeAgo strings and the pre-formatted 'Aug 25, 2025' display fields in four mock arrays.
- core/util/enum-label.pipe.ts — standalone pure pipe: {{ r.status | enumLabel:'requestStatus' }} reading the maps in core/reference/enum-labels.ts. One place converts UPPER_SNAKE to display text for all 13 enums; no template ever contains a switch again.
- core/pages/forbidden/forbidden.ts — a designed 403 page with a 'Back to my dashboard' button using auth.homeRoute(). This is the screen demo step 8 lands on twice; it is a scoring surface, not an error page.
- core/pages/not-found/not-found.ts — a 404 inside the authenticated shell. Today '**' redirects to auth/login, which makes a typo look like a session failure in front of an examiner.

---

## Bundle budget

## Measured on this machine today, not estimated

I ran three production builds in `D:/Program/Angular/Disaster Management/frontend` and reverted every change.

| Build | main | shared chunks | polyfills | styles | **initial total** |
|---|---|---|---|---|---|
| **As-is (baseline)** | 426.21 kB | — | 34.58 kB | 40.33 kB | **501.12 kB** (budget error at 500) |
| + `loadComponent` on all routes, + `mat.theme()` deleted | 2.21 kB | 162.95 + 73.22 kB | 34.58 kB | 32.39 kB | **305.34 kB** |
| + `provideHttpClient(withFetch)` + `ReactiveFormsModule` + `withComponentInputBinding()` | 2.26 kB | 185.45 + 73.22 kB | 34.58 kB | 32.39 kB | **327.89 kB** |

**The budget problem is solved by Phase 0 and never comes back.** Two levers, roughly two hours, and you finish at 327.89 kB with **172 kB of headroom** against the 500 kB ceiling — with HttpClient, reactive forms and router input binding already counted.

## Lever 1 — `loadComponent` on all 19 routes (worth ~188 kB, ~1.5h)

Measured: this alone drops `main` from 426.21 kB to 2.21 kB. Every feature component becomes its own lazy chunk (largest: `request` 7.75 kB, `request-status` 7.31 kB, `dashboard` 6.62 kB); `main-layout` is 18.79 kB and loads once after login. The 162.95/185.45 kB shared chunk is the Angular framework itself and is irreducible.

Do it as a **mechanical rewrite of app.routes.ts** — delete all 18 top-of-file imports, replace each `component: X` with `loadComponent: () => import('...').then(m => m.X)`. The full file is in `appConfigChanges`. Fifteen minutes of typing, `ng build` confirms it immediately.

Side benefit worth a viva sentence: the admin bundles are never downloaded by a victim's browser. Code-splitting on the role boundary is defence in depth on top of `roleGuard`.

## Lever 2 — delete Angular Material entirely (worth 7.94 kB CSS + 40 MB node_modules, ~15 min)

Measured: `styles.css` goes 40.33 → 32.39 kB. Smaller than expected because Tailwind dominates that file and `mat.theme()` only emits CSS custom properties — **Material was never in the JS bundle at all**, because no component imports a Material module. So the honest framing for the report is: it was dead weight in the dependency tree and the stylesheet, not the bundle.

1. `npm uninstall @angular/material @angular/cdk autoprefixer @fortawesome/free-brands-svg-icons`
   (`autoprefixer` is redundant under Tailwind 4's PostCSS plugin; `free-brands-svg-icons` exists only for the `faGoogle` button being deleted.)
2. Replace `styles.scss` with the 8-line version in `appConfigChanges` — this also removes the `--mat-sys-surface` / `--mat-sys-body-medium` dependency in `body`, which would otherwise leave the page unstyled the moment you drop the Material import.
3. Delete the Material Icons `<link>` **and** the Roboto Google Fonts `<link>` from `index.html`. Neither affects the measured bundle number, but both are render-blocking external requests that stall first paint on an offline exam-hall laptop. Use the system font stack.

## Then turn the budget into a regression test

Once you are at ~328 kB, tighten `angular.json`:

```json
{ "type": "initial", "maximumWarning": "400kB", "maximumError": "500kB" }
```

Now an accidental eager import — someone importing `AllRequests` at the top of `app.routes.ts` again, or `import * as L from 'leaflet'` — fails the build loudly instead of silently eating the headroom. This is one line and it is the only "CI" the project has.

## What the remaining 172 kB of headroom is reserved for

Everything still to be written is measured or near-zero:
- HttpClient + ReactiveForms + input binding: **already counted** (22.55 kB).
- ~45 hand-written interfaces in `core/models/*`: **0 kB** — TypeScript types are erased.
- The 10 shared UI components + 2 pipes: they are imported by `app.ts`/`main-layout`, so they land in the eager chunk. Budget ~8-12 kB total; they are small inline-template components.
- The 14 additional FontAwesome icons: FontAwesome is already per-icon tree-shaken (every file imports named icons, not the barrel), roughly 0.4 kB each.
- 20 facade services: ~1-2 kB each, and each lands in its own route chunk, not the initial.

Realistic landing point at the end of week 4: **340-355 kB initial**, comfortably inside 400.

## Explicitly not doing

- **Chart.js** — the 7-day trend is seven `<div>`s with `[style.height.%]`. Adding a charting library to hit a 500 kB budget is the exact trade the scope already ruled against.
- **Leaflet** — all maps are cut.
- **Zoneless change detection** — would delete the 34.58 kB `polyfills` chunk entirely, and it is tempting. It is cut, correctly: it would require auditing every `setInterval`, every `.subscribe()` and the FontAwesome component for OnPush correctness, for a saving you do not need and marks nobody awards.
- **Source-map-explorer / webpack-bundle-analyzer** — you have the numbers above. Do not spend an evening on tooling for a problem that is already 172 kB solved.

## The one thing to check after Phase 0

Run `npx ng build` (never a bare `ng build` — the global CLI v21.1.5 shadows the v20.1.6 workspace) and confirm the initial total prints around 305 kB with no budget warning. If it prints anything above 400 kB, something is still eagerly imported — grep `app.routes.ts` and `app.ts` for a stray `import { X } from './features/...'`.
