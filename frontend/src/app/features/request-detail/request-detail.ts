import { Component, Input, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RequestsStore, type RequestItem, type TimelineEvent } from '../../core/services/requests.store';
import { AuthStore } from '../../core/services/auth.store';
import { ToastService } from '../../core/services/toast';
import { StatePanel } from '../../shared/state-panel';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { STATUS_CLASS, URGENCY_CLASS, label, dateTime, when, distance } from '../../shared/ui';
import type { ApiError } from '../../core/services/api';

/**
 * One screen, three audiences.
 *
 * The victim, the assigned volunteer and an administrator all land here. What
 * each of them sees is decided by the `permissions` block the server attaches
 * to the request, not by three separate templates and not by guessing from the
 * role in the browser.
 *
 * This screen did not exist before: eight "View Details" buttons across the
 * application pointed at nothing.
 */
@Component({
  selector: 'app-request-detail',
  imports: [RouterLink, StatePanel, ConfirmDialog],
  templateUrl: './request-detail.html',
})
export class RequestDetail {
  private store = inject(RequestsStore);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly auth = inject(AuthStore);

  readonly request = signal<RequestItem | null>(null);
  readonly timeline = signal<TimelineEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly confirmCancel = signal(false);

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly URGENCY_CLASS = URGENCY_CLASS;
  readonly distance = distance;
  readonly label = label;
  readonly dateTime = dateTime;
  readonly when = when;

  /** Bound from the route by withComponentInputBinding(). */
  @Input() set id(value: string) { this.fetch(value); }

  private async fetch(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.store.getOne(id);
      this.request.set(r.request);
      this.timeline.set(r.timeline);
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load this request.');
    } finally {
      this.loading.set(false);
    }
  }

  reload(): void {
    const r = this.request();
    if (r) this.fetch(String(r.id));
  }

  goBack(): void { history.back(); }

  async doCancel(): Promise<void> {
    const r = this.request();
    if (!r) return;
    this.busy.set(true);
    try {
      await this.store.cancel(r.id);
      this.toast.success('Request cancelled', 'It is no longer visible to volunteers.');
      this.confirmCancel.set(false);
      this.reload();
    } catch (e) {
      this.toast.error('Could not cancel', (e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  async doClaim(): Promise<void> {
    const r = this.request();
    if (!r) return;
    this.busy.set(true);
    try {
      await this.store.claim(r.id);
      this.toast.success('Request accepted', 'Contact details are now visible to you.');
      this.reload();
    } catch (e) {
      const err = e as ApiError;
      this.toast.error(err.code === 'ALREADY_CLAIMED' ? 'Too late' : 'Could not accept', err.message);
      this.reload();
    } finally {
      this.busy.set(false);
    }
  }

  goFeedback(): void {
    const r = this.request();
    if (r) this.router.navigate(['/victim/feedback', r.id]);
  }
}
