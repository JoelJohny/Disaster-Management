import { tx, q1, exec } from '../db/pool.js';
import * as repo from '../repositories/requests.repo.js';
import { coordsFor } from '../lib/geo.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import type { AuthUser } from '../middleware/auth.js';
import type { CreateRequestBody, RequestDto, RequestStatus } from '@drms/contracts';

/**
 * The permitted state machine. Enforced on the server, so hiding a button in
 * the UI is convenience and THIS is the actual rule.
 */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  SUBMITTED:   ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:    ['IN_PROGRESS', 'SUBMITTED', 'CANCELLED'],  // back to SUBMITTED = released
  IN_PROGRESS: ['COMPLETED', 'SUBMITTED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

export function assertTransition(from: RequestStatus, to: RequestStatus) {
  if (!TRANSITIONS[from].includes(to)) {
    throw badRequest(
      `Cannot move a request from ${from.replace('_', ' ')} to ${to.replace('_', ' ')}.`,
      'ILLEGAL_TRANSITION',
    );
  }
}

/**
 * Decide what the viewer is allowed to SEE, and shape the row accordingly.
 *
 * Victim contact details are withheld from a volunteer until that volunteer has
 * accepted the request. The queue is a list of isolated households identified
 * by location and telephone number; it is not browsing material.
 */
export function toDto(row: repo.RequestRow, viewer: AuthUser): RequestDto {
  const isOwner = row.victim_id === viewer.id;
  const isAdmin = viewer.role === 'ADMIN';
  const isAssignedVolunteer = row.volunteer_id === viewer.id;
  const maySeeVictim = isOwner || isAdmin || isAssignedVolunteer;

  const active = row.assignment_status === 'ASSIGNED' || row.assignment_status === 'IN_PROGRESS';

  return {
    id: row.id,
    reference: row.reference,
    categoryCode: row.category_code as any,
    categoryName: row.category_name,
    urgency: row.urgency,
    status: row.status,
    description: row.description,
    locationText: row.location_text,
    district: row.district,
    peopleCount: row.people_count,
    source: row.source,
    submittedAt: new Date(row.submitted_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    disasterTitle: row.disaster_title,
    distanceKm: row.distance_km ?? null,

    victim: maySeeVictim
      ? { id: row.victim_id, fullName: row.victim_name, phone: row.victim_phone }
      : null,

    volunteer: row.volunteer_id
      ? {
          id: row.volunteer_id,
          fullName: row.volunteer_name!,
          phone: maySeeVictim || isAssignedVolunteer ? row.volunteer_phone! : '',
          ratingAvg: row.volunteer_rating,
        }
      : null,

    assignment: row.assignment_id
      ? {
          id: row.assignment_id,
          status: row.assignment_status as any,
          progressPct: row.progress_pct ?? 0,
          hoursLogged: row.hours_logged,
          completionNotes: row.completion_notes,
        }
      : null,

    hasFeedback: Boolean(row.has_feedback),

    permissions: {
      canCancel: isOwner && row.status === 'SUBMITTED',
      canClaim:
        viewer.role === 'VOLUNTEER' &&
        viewer.approvalStatus === 'APPROVED' &&
        row.status === 'SUBMITTED',
      canUpdateStatus: isAssignedVolunteer && active,
      canLeaveFeedback: isOwner && row.status === 'COMPLETED' && !row.has_feedback,
    },
  };
}

export async function create(user: AuthUser, input: CreateRequestBody) {
  const { lat, lng } = coordsFor(input.district);

  const category = await q1<{ id: number }>(
    'SELECT id FROM request_categories WHERE code = ?',
    [input.categoryCode],
  );
  if (!category) throw badRequest('Unknown request category.');

  // Attach to whichever active disaster event covers this point.
  const disaster = await repo.findCoveringDisaster(lat, lng);

  // The account always has a phone number, which is why SOS can post without one.
  const contactPhone = input.contactPhone ?? user.phone;

  return tx(async c => {
    const reference = await repo.nextReference(c);

    const [res]: any = await c.execute(
      `INSERT INTO requests
         (reference, user_id, disaster_id, category_id, urgency, status, description,
          location_text, district, latitude, longitude, people_count, contact_phone, source)
       VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference, user.id, disaster?.id ?? null, category.id, input.urgency,
        input.description, input.locationText, input.district, lat, lng,
        input.peopleCount, contactPhone,
        (input as any).source === 'SOS' ? 'SOS' : 'WEB',
      ],
    );
    const id = res.insertId as number;

    await repo.addStatusEvent(c, id, null, 'SUBMITTED', user.id, user.role);
    await repo.addAudit(c, user.id, 'request.create', 'request', id, false, reference);

    return { id, reference };
  });
}

/**
 * *** THE ATOMIC CLAIM ***
 *
 * Two layers, deliberately:
 *
 *  1. A conditional UPDATE inside a transaction. `WHERE status='SUBMITTED'`
 *     means the second caller updates zero rows and loses cleanly, which is
 *     what lets us name the winner in the error message.
 *
 *  2. The UNIQUE index on the generated column. Even if a future code path
 *     skips step 1 entirely — an admin screen, a script, somebody in Adminer —
 *     the database still refuses the second active assignment with errno 1062.
 *
 * Step 1 gives a good message. Step 2 is what makes the rule TRUE.
 */
export async function claim(user: AuthUser, requestId: number) {
  try {
    return await tx(async c => {
      // SELECT ... FOR UPDATE serialises concurrent claimers on this row.
      const [rows]: any = await c.execute(
        'SELECT id, status, user_id FROM requests WHERE id = ? FOR UPDATE',
        [requestId],
      );
      const req = rows[0];
      if (!req) throw notFound('That request no longer exists.');

      if (req.status !== 'SUBMITTED') {
        const [w]: any = await c.execute(
          `SELECT u.full_name FROM assignments a JOIN users u ON u.id = a.volunteer_id
            WHERE a.request_id = ? AND a.status IN ('ASSIGNED','IN_PROGRESS') LIMIT 1`,
          [requestId],
        );
        const winner = w[0]?.full_name?.split(' ')[0];
        throw conflict(
          winner ? `Already accepted by ${winner}.` : 'This request has already been accepted.',
          'ALREADY_CLAIMED',
        );
      }

      await c.execute(
        `UPDATE requests SET status = 'ASSIGNED' WHERE id = ? AND status = 'SUBMITTED'`,
        [requestId],
      );

      const [ins]: any = await c.execute(
        `INSERT INTO assignments (request_id, volunteer_id, status) VALUES (?, ?, 'ASSIGNED')`,
        [requestId, user.id],
      );

      await repo.addStatusEvent(c, requestId, 'SUBMITTED', 'ASSIGNED', user.id, user.role);
      await repo.addNotification(
        c, req.user_id, 'REQUEST_ASSIGNED', 'Volunteer assigned',
        `${user.fullName} has accepted your request.`, '/victim/my-requests',
      );
      // Accepting a request discloses the victim's name, phone and address.
      await repo.addAudit(c, user.id, 'request.claim', 'request', requestId, true,
        'Contact details released on claim');

      return { assignmentId: ins.insertId as number };
    });
  } catch (e: any) {
    // The database backstop fired: somebody beat us between the check and the insert.
    if (e?.errno === 1062) {
      throw conflict('This request has already been accepted.', 'ALREADY_CLAIMED');
    }
    if (e?.errno === 1213 || e?.errno === 1205) {
      throw conflict('The system is busy. Please try again.', 'LOCK_TIMEOUT');
    }
    throw e;
  }
}

export async function updateAssignment(
  user: AuthUser,
  assignmentId: number,
  input: { action: string; progressPct?: number; hoursLogged?: number; completionNotes?: string },
) {
  return tx(async c => {
    const [rows]: any = await c.execute(
      `SELECT a.*, r.status AS request_status, r.user_id AS victim_id, r.reference
         FROM assignments a JOIN requests r ON r.id = a.request_id
        WHERE a.id = ? FOR UPDATE`,
      [assignmentId],
    );
    const a = rows[0];
    if (!a) throw notFound('Assignment not found.');
    if (a.volunteer_id !== user.id && user.role !== 'ADMIN') {
      throw forbidden('This task is not assigned to you.');
    }

    const from: RequestStatus = a.request_status;

    if (input.action === 'START') {
      assertTransition(from, 'IN_PROGRESS');
      await c.execute(
        `UPDATE assignments SET status='IN_PROGRESS', started_at=UTC_TIMESTAMP(3), progress_pct=? WHERE id=?`,
        [input.progressPct ?? 10, assignmentId],
      );
      await c.execute(`UPDATE requests SET status='IN_PROGRESS' WHERE id=?`, [a.request_id]);
      await repo.addStatusEvent(c, a.request_id, from, 'IN_PROGRESS', user.id, user.role);
      return { status: 'IN_PROGRESS' };
    }

    if (input.action === 'PROGRESS') {
      if (a.status !== 'IN_PROGRESS') throw badRequest('Start the task before recording progress.');
      await c.execute(`UPDATE assignments SET progress_pct=? WHERE id=?`,
        [input.progressPct ?? 0, assignmentId]);
      return { status: 'IN_PROGRESS' };
    }

    if (input.action === 'COMPLETE') {
      assertTransition(from, 'COMPLETED');
      await c.execute(
        `UPDATE assignments
            SET status='COMPLETED', progress_pct=100, hours_logged=?, completion_notes=?,
                completed_at=UTC_TIMESTAMP(3)
          WHERE id=?`,
        [input.hoursLogged ?? 0, input.completionNotes ?? null, assignmentId],
      );
      await c.execute(
        `UPDATE requests SET status='COMPLETED', completed_at=UTC_TIMESTAMP(3) WHERE id=?`,
        [a.request_id],
      );
      // Keep the volunteer's running totals in step with the assignment rows.
      await c.execute(
        `UPDATE volunteer_profiles
            SET hours_logged = hours_logged + ?, completed_count = completed_count + 1
          WHERE user_id = ?`,
        [input.hoursLogged ?? 0, a.volunteer_id],
      );
      await repo.addStatusEvent(c, a.request_id, from, 'COMPLETED', user.id, user.role);
      await repo.addNotification(
        c, a.victim_id, 'REQUEST_COMPLETED', 'Request completed',
        `${a.reference} was completed. You can now leave feedback.`, '/victim/my-requests',
      );
      return { status: 'COMPLETED' };
    }

    if (input.action === 'RELEASE') {
      assertTransition(from, 'SUBMITTED');
      // Setting the assignment inactive clears the generated column, which
      // releases the unique index and returns the request to the pool.
      await c.execute(
        `UPDATE assignments SET status='RELEASED', released_at=UTC_TIMESTAMP(3) WHERE id=?`,
        [assignmentId],
      );
      await c.execute(`UPDATE requests SET status='SUBMITTED' WHERE id=?`, [a.request_id]);
      await repo.addStatusEvent(c, a.request_id, from, 'SUBMITTED', user.id, user.role,
        'Released back to the pool');
      return { status: 'SUBMITTED' };
    }

    throw badRequest('Unknown action.');
  });
}

export async function cancel(user: AuthUser, requestId: number, reason?: string) {
  return tx(async c => {
    const [rows]: any = await c.execute(
      'SELECT id, status, user_id FROM requests WHERE id = ? FOR UPDATE',
      [requestId],
    );
    const r = rows[0];
    if (!r) throw notFound('Request not found.');
    if (r.user_id !== user.id && user.role !== 'ADMIN') {
      throw forbidden('You can only cancel your own requests.');
    }
    assertTransition(r.status, 'CANCELLED');

    await c.execute(
      `UPDATE requests SET status='CANCELLED', cancelled_at=UTC_TIMESTAMP(3) WHERE id=?`,
      [requestId],
    );
    await repo.addStatusEvent(c, requestId, r.status, 'CANCELLED', user.id, user.role, reason);
    return { status: 'CANCELLED' };
  });
}

export async function addFeedback(
  user: AuthUser,
  requestId: number,
  input: { rating: number; comments?: string; contactPermission: boolean },
) {
  const row = await repo.findById(requestId);
  if (!row) throw notFound('Request not found.');
  if (row.victim_id !== user.id) throw forbidden('You can only rate your own requests.');
  if (row.status !== 'COMPLETED') throw badRequest('You can only rate a completed request.');

  try {
    await exec(
      `INSERT INTO feedback (request_id, user_id, volunteer_id, rating, comments, contact_permission)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requestId, user.id, row.volunteer_id, input.rating, input.comments ?? null,
       input.contactPermission],
    );
  } catch (e: any) {
    // UNIQUE(request_id) — "one rating per request" is a database rule, not an
    // if-statement in this service.
    if (e?.errno === 1062) throw conflict('Feedback already submitted for this request.', 'DUPLICATE_FEEDBACK');
    throw e;
  }

  if (row.volunteer_id) {
    await exec(
      `UPDATE volunteer_profiles vp
          SET rating_count = (SELECT COUNT(*) FROM feedback f WHERE f.volunteer_id = vp.user_id),
              rating_avg   = (SELECT AVG(f.rating) FROM feedback f WHERE f.volunteer_id = vp.user_id)
        WHERE vp.user_id = ?`,
      [row.volunteer_id],
    );
  }
  return { ok: true };
}
