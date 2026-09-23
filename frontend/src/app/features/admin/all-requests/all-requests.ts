import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../../core/services/api';
import { RequestsStore, type RequestItem } from '../../../core/services/requests.store';
import { ReferenceStore } from '../../../core/services/reference.store';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import { STATUS_CLASS, URGENCY_CLASS, label, when } from '../../../shared/ui';

interface VolunteerOption {
  id: number; fullName: string; district: string;
  completedCount: number; ratingAvg: number | null; activeTasks: number;
}

const FILTERS = ['ALL', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
type Filter = (typeof FILTERS)[number];

@Component({
  selector: 'app-all-requests',
  imports: [FormsModule, RouterLink, StatePanel],
  templateUrl: './all-requests.html',
  styleUrl: './all-requests.scss',
})
export class AllRequests {
  readonly store = inject(RequestsStore);
  readonly ref = inject(ReferenceStore);
  private api = inject(Api);
  private toast = inject(ToastService);

  readonly filters = FILTERS;
  readonly active = signal<Filter>('ALL');
  readonly category = signal('');
  readonly urgency = signal('');
  search = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // assign dialog
  readonly assigning = signal<RequestItem | null>(null);
  readonly volunteers = signal<VolunteerOption[]>([]);
  readonly assignBusy = signal(false);
  chosenVolunteer: number | null = null;

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly URGENCY_CLASS = URGENCY_CLASS;
  readonly label = label;
  readonly when = when;

  constructor() { this.ref.load(); this.load(); }

  load(): void {
    const f = this.active();
    this.store.load('all', {
      status: f === 'ALL' ? undefined : f,
      categoryCode: this.category() || undefined,
      urgency: this.urgency() || undefined,
      q: this.search || undefined,
      pageSize: 25,
    });
  }

  setFilter(f: Filter): void { this.active.set(f); this.store.page.set(1); this.load(); }
  setCategory(c: string): void { this.category.set(c); this.load(); }
  setUrgency(u: string): void { this.urgency.set(u); this.load(); }

  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  countFor(f: Filter): number {
    return f === 'ALL' ? this.store.total() : (this.store.counts()[f] ?? 0);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.store.total() / this.store.pageSize()));
  }

  goPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.store.page.set(p);
    this.load();
  }

  async openAssign(r: RequestItem): Promise<void> {
    this.assigning.set(r);
    this.chosenVolunteer = null;
    try {
      const v = await firstValueFrom(this.api.get<any>('/volunteers'));
      this.volunteers.set(v.items ?? []);
    } catch {
      this.volunteers.set([]);
    }
  }

  /**
   * The admin assign path calls the SAME claim service a volunteer uses, so it
   * is protected by the same unique index. There is no second, weaker route
   * into an assignment.
   */
  async confirmAssign(): Promise<void> {
    const r = this.assigning();
    if (!r || !this.chosenVolunteer) return;
    this.assignBusy.set(true);
    try {
      await firstValueFrom(
        this.api.post(`/requests/${r.id}/assign`, { volunteerId: this.chosenVolunteer }),
      );
      this.toast.success('Volunteer assigned', r.reference);
      this.assigning.set(null);
      this.load();
    } catch (e) {
      this.toast.error('Could not assign', (e as ApiError).message);
    } finally {
      this.assignBusy.set(false);
    }
  }
}
