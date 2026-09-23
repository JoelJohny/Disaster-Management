import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestsStore } from '../../../core/services/requests.store';
import { StatePanel } from '../../../shared/state-panel';
import { STATUS_CLASS, URGENCY_CLASS, label, when } from '../../../shared/ui';

const FILTERS = ['ALL', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
type Filter = (typeof FILTERS)[number];

@Component({
  selector: 'app-request-status',
  imports: [RouterLink, StatePanel],
  templateUrl: './request-status.html',
  styleUrl: './request-status.scss',
})
export class RequestStatus {
  readonly store = inject(RequestsStore);

  readonly filters = FILTERS;
  readonly active = signal<Filter>('ALL');

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly URGENCY_CLASS = URGENCY_CLASS;
  readonly label = label;
  readonly when = when;

  constructor() { this.load(); }

  load(): void {
    const f = this.active();
    this.store.load('mine', f === 'ALL' ? {} : { status: f });
  }

  setFilter(f: Filter): void {
    this.active.set(f);
    this.store.page.set(1);
    this.load();
  }

  /**
   * Counts come from the server envelope, not from filtering an array here, so
   * they stay correct across pagination instead of only describing this page.
   */
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
}
