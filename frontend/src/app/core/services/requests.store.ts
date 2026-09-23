import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from './api';

export interface RequestItem {
  id: number; reference: string; categoryCode: string; categoryName: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  description: string; locationText: string; district: string; peopleCount: number;
  source: string; submittedAt: string; completedAt: string | null;
  disasterTitle: string | null; distanceKm: number | null;
  victim: { id: number; fullName: string; phone: string } | null;
  volunteer: { id: number; fullName: string; phone: string; ratingAvg: number | null } | null;
  assignment: { id: number; status: string; progressPct: number; hoursLogged: number | null; completionNotes: string | null } | null;
  hasFeedback: boolean;
  permissions: { canCancel: boolean; canClaim: boolean; canUpdateStatus: boolean; canLeaveFeedback: boolean };
}

export interface TimelineEvent {
  id: number; fromStatus: string | null; toStatus: string;
  actorName: string; actorRole: string; reason: string | null; occurredAt: string;
}

export type Scope = 'mine' | 'available' | 'assigned' | 'all';

const EMPTY_COUNTS = { SUBMITTED: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 };

/**
 * The feature-store pattern: readonly signals out, methods in, all the async
 * mess kept inside. Copy this shape for any other list screen.
 */
@Injectable({ providedIn: 'root' })
export class RequestsStore {
  private api = inject(Api);

  readonly items = signal<RequestItem[]>([]);
  readonly total = signal(0);
  readonly counts = signal<Record<string, number>>({ ...EMPTY_COUNTS });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(10);

  async load(scope: Scope, filters: Record<string, unknown> = {}): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.get<any>('/requests', {
        scope, page: this.page(), pageSize: this.pageSize(), ...filters,
      }));
      this.items.set(r.items ?? []);
      this.total.set(r.total ?? 0);
      this.counts.set({ ...EMPTY_COUNTS, ...(r.counts ?? {}) });
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load requests.');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  getOne(id: number | string) {
    return firstValueFrom(
      this.api.get<{ request: RequestItem; timeline: TimelineEvent[] }>(`/requests/${id}`),
    );
  }

  create(payload: Record<string, unknown>) {
    return firstValueFrom(this.api.post<{ id: number; reference: string }>('/requests', payload));
  }

  claim(id: number) {
    return firstValueFrom(this.api.post<{ assignmentId: number }>(`/requests/${id}/claim`));
  }

  cancel(id: number, reason?: string) {
    return firstValueFrom(this.api.post(`/requests/${id}/cancel`, { reason }));
  }

  updateAssignment(assignmentId: number, payload: Record<string, unknown>) {
    return firstValueFrom(this.api.patch<{ status: string }>(`/assignments/${assignmentId}`, payload));
  }

  feedback(requestId: number, payload: Record<string, unknown>) {
    return firstValueFrom(this.api.post(`/requests/${requestId}/feedback`, payload));
  }
}
