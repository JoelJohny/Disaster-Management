/** Presentation helpers shared by every screen that shows a status or urgency. */

export const STATUS_CLASS: Record<string, string> = {
  SUBMITTED:   'bg-blue-100 text-blue-800',
  ASSIGNED:    'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED:   'bg-green-100 text-green-800',
  CANCELLED:   'bg-gray-100 text-gray-600',
  PENDING:     'bg-amber-100 text-amber-800',
  APPROVED:    'bg-green-100 text-green-800',
  REJECTED:    'bg-red-100 text-red-800',
  ACTIVE:      'bg-red-100 text-red-800',
  UPCOMING:    'bg-amber-100 text-amber-800',
  PAST:        'bg-gray-100 text-gray-600',
  OPEN:        'bg-green-100 text-green-800',
  FULL:        'bg-amber-100 text-amber-800',
  CLOSED:      'bg-gray-100 text-gray-600',
};

export const URGENCY_CLASS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH:     'bg-orange-100 text-orange-800',
  MEDIUM:   'bg-blue-100 text-blue-800',
  LOW:      'bg-green-100 text-green-800',
};

export const label = (v: string | null | undefined) =>
  (v ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN',
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * Distance for display.
 *
 * Coordinates come from district centroids, so a request and a volunteer in the
 * same district are genuinely ~0 km apart. Printing "0 km away" reads like a
 * bug, so anything under a kilometre is described rather than measured.
 */
export function distance(km: number | null | undefined): string {
  if (km == null) return '';
  if (km < 1) return 'in your area';
  return `${km} km away`;
}
