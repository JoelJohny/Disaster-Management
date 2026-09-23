import { z } from 'zod';

// ============================================================================
//  Shared contracts — the single source of truth for both halves.
//
//  The API validates every request body against these schemas; the Angular
//  forms build their validators from the same definitions. The rules therefore
//  cannot drift apart, and a rule tightened on the server cannot be silently
//  bypassed by an out-of-date client.
// ============================================================================

// ------------------------------------------------------------ enums -------
export const ROLES = ['ADMIN', 'VOLUNTEER', 'VICTIM', 'DONOR'] as const;
export const URGENCIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const REQUEST_STATUSES = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'RELEASED'] as const;
export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const CATEGORY_CODES = ['MEDICAL', 'RESCUE', 'FOOD_WATER', 'SHELTER', 'OTHER'] as const;
export const DISASTER_STATES = ['UPCOMING', 'ACTIVE', 'PAST'] as const;
export const SEVERITIES = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'] as const;
export const CAMP_STATUSES = ['OPEN', 'FULL', 'CLOSED'] as const;

export type Role = (typeof ROLES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type CategoryCode = (typeof CATEGORY_CODES)[number];
export type DisasterState = (typeof DISASTER_STATES)[number];

export const zRole = z.enum(ROLES);
export const zUrgency = z.enum(URGENCIES);
export const zRequestStatus = z.enum(REQUEST_STATUSES);
export const zCategoryCode = z.enum(CATEGORY_CODES);

// --------------------------------------------------- shared primitives ----
// Indian mobile numbers, with or without the +91 prefix and internal spaces.
const phone = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .refine(v => /^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/.test(v.replace(/\s+/g, ' ')),
    'Enter a valid Indian mobile number');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(190);

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')  // bcrypt truncates beyond 72 bytes
  .refine(v => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine(v => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine(v => /\d/.test(v), 'Password must contain a digit');

export const KERALA_DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
  'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
] as const;
const district = z.enum(KERALA_DISTRICTS, {
  errorMap: () => ({ message: 'Select a district' }),
});

// ------------------------------------------------------------- auth -------
export const RegisterBody = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    email,
    phone,
    district,
    role: z.enum(['VICTIM', 'VOLUNTEER'], { errorMap: () => ({ message: 'Choose victim or volunteer' }) }),
    password,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  })
  .refine(v => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const UpdateProfileBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone,
  district,
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

// ---------------------------------------------------------- requests ------
// NOTE: flat, deliberately. The API shape does not mirror the three-step
// wizard; the client maps its nested form groups onto this on submit.
export const CreateRequestBody = z.object({
  categoryCode: zCategoryCode,
  urgency: zUrgency,
  district,
  locationText: z.string().trim().min(3, 'Describe where you are').max(255),
  // `invalid_type_error` covers the empty-field case, where coercion yields NaN
  // and the default message ("Expected number, received nan") means nothing to
  // somebody filling in a form during a flood.
  peopleCount: z.coerce
    .number({ invalid_type_error: 'Enter how many people need help' })
    .int('Enter a whole number')
    .min(1, 'At least 1 person')
    .max(999, 'That is more than this form can handle — please call the helpline'),
  description: z.string().trim().min(10, 'Please describe your situation').max(2000),
  // Optional: the server falls back to the account's own phone number, which
  // is why the SOS button can post without it.
  contactPhone: phone.optional(),
});
export type CreateRequestBody = z.infer<typeof CreateRequestBody>;

export const ListRequestsQuery = z.object({
  scope: z.enum(['mine', 'available', 'assigned', 'all']).default('mine'),
  status: zRequestStatus.optional(),
  categoryCode: zCategoryCode.optional(),
  urgency: zUrgency.optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(['urgency', 'distance', 'newest']).default('newest'),
});
export type ListRequestsQuery = z.infer<typeof ListRequestsQuery>;

export const CancelRequestBody = z.object({
  reason: z.string().trim().max(255).optional(),
});

// ------------------------------------------------------- assignments ------
export const UpdateAssignmentBody = z
  .object({
    action: z.enum(['START', 'PROGRESS', 'COMPLETE', 'RELEASE']),
    progressPct: z.coerce.number().int().min(0).max(100).optional(),
    hoursLogged: z.coerce.number().min(0).max(999).optional(),
    completionNotes: z.string().trim().max(500).optional(),
  })
  .refine(v => v.action !== 'COMPLETE' || v.hoursLogged != null, {
    message: 'Enter the hours you spent',
    path: ['hoursLogged'],
  });
export type UpdateAssignmentBody = z.infer<typeof UpdateAssignmentBody>;

export const AssignVolunteerBody = z.object({
  volunteerId: z.coerce.number().int().positive(),
});

// ---------------------------------------------------------- feedback ------
export const CreateFeedbackBody = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating').max(5),
  comments: z.string().trim().max(1000).optional(),
  contactPermission: z.boolean().default(false),
});
export type CreateFeedbackBody = z.infer<typeof CreateFeedbackBody>;

// ------------------------------------------------------------- admin ------
export const ListUsersQuery = z.object({
  role: zRole.optional(),
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const VolunteerApprovalBody = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});

export const SetUserActiveBody = z.object({
  isActive: z.boolean(),
});

export const CreateDisasterBody = z.object({
  title: z.string().trim().min(3).max(120),
  type: z.string().trim().min(3).max(50),
  severity: z.enum(SEVERITIES),
  district,
  radiusKm: z.coerce.number().int().min(1).max(200).default(25),
  helplineNumber: z.string().trim().max(20).optional(),
  description: z.string().trim().max(500).optional(),
  startDate: z.string().min(1, 'Choose a start date'),
  endDate: z.string().optional().nullable(),
});
export type CreateDisasterBody = z.infer<typeof CreateDisasterBody>;

// ------------------------------------------------- response envelopes -----
export interface ListEnvelope<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<string, number>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
}

// ------------------------------------------------------------- DTOs -------
export interface UserDto {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  district: string;
  isActive: boolean;
  approvalStatus?: ApprovalStatus;
  createdAt: string;
}

export interface VolunteerStatsDto {
  approvalStatus: ApprovalStatus;
  serviceRadiusKm: number;
  hoursLogged: number;
  completedCount: number;
  ratingAvg: number | null;
  ratingCount: number;
  skills: string[];
}

export interface RequestDto {
  id: number;
  reference: string;
  categoryCode: CategoryCode;
  categoryName: string;
  urgency: Urgency;
  status: RequestStatus;
  description: string;
  locationText: string;
  district: string;
  peopleCount: number;
  source: string;
  submittedAt: string;
  completedAt: string | null;
  disasterTitle: string | null;
  distanceKm?: number | null;
  /** Present only once the viewer is entitled to see it. */
  victim?: { id: number; fullName: string; phone: string } | null;
  volunteer?: { id: number; fullName: string; phone: string; ratingAvg: number | null } | null;
  assignment?: {
    id: number;
    status: AssignmentStatus;
    progressPct: number;
    hoursLogged: number | null;
    completionNotes: string | null;
  } | null;
  hasFeedback?: boolean;
  /** What the current viewer may do with this request. */
  permissions?: {
    canCancel: boolean;
    canClaim: boolean;
    canUpdateStatus: boolean;
    canLeaveFeedback: boolean;
  };
}

export interface StatusEventDto {
  id: number;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorName: string;
  actorRole: Role;
  reason: string | null;
  occurredAt: string;
}

export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  targetUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CampDto {
  id: number;
  name: string;
  address: string;
  district: string;
  capacity: number;
  currentOccupancy: number;
  status: (typeof CAMP_STATUSES)[number];
  contactPhone: string | null;
  distanceKm?: number | null;
}

export interface DisasterDto {
  id: number;
  title: string;
  type: string;
  severity: (typeof SEVERITIES)[number];
  district: string;
  radiusKm: number;
  helplineNumber: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  /** Derived in SQL from the dates — never stored. */
  state: DisasterState;
}

export interface CategoryDto {
  id: number;
  code: CategoryCode;
  name: string;
  iconKey: string;
  colorKey: string;
}

export interface ReferenceDto {
  categories: CategoryDto[];
  districts: string[];
  skills: { id: number; code: string; name: string }[];
  activeDisaster: DisasterDto | null;
}
