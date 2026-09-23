import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RequestsStore, type RequestItem } from '../../../core/services/requests.store';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import { STATUS_CLASS, URGENCY_CLASS, label, when } from '../../../shared/ui';
import type { ApiError } from '../../../core/services/api';

@Component({
  selector: 'app-assigned-tasks',
  imports: [FormsModule, RouterLink, StatePanel],
  templateUrl: './assigned-tasks.html',
  styleUrl: './assigned-tasks.scss',
})
export class AssignedTasks {
  readonly store = inject(RequestsStore);
  private toast = inject(ToastService);

  readonly busy = signal<number | null>(null);

  // completion dialog state
  readonly completing = signal<RequestItem | null>(null);
  hours = 1;
  notes = '';

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly URGENCY_CLASS = URGENCY_CLASS;
  readonly label = label;
  readonly when = when;

  constructor() { this.load(); }

  load(): void { this.store.load('assigned', { pageSize: 50 }); }

  active(r: RequestItem): boolean {
    return r.assignment?.status === 'ASSIGNED' || r.assignment?.status === 'IN_PROGRESS';
  }

  private async act(r: RequestItem, payload: Record<string, unknown>, ok: string): Promise<void> {
    if (!r.assignment) return;
    this.busy.set(r.id);
    try {
      await this.store.updateAssignment(r.assignment.id, payload);
      this.toast.success(ok, r.reference);
      this.load();
    } catch (e) {
      const err = e as ApiError;
      // ILLEGAL_TRANSITION is the server refusing a step the lifecycle forbids.
      this.toast.error(
        err.code === 'ILLEGAL_TRANSITION' ? 'Not allowed' : 'Could not update',
        err.message,
      );
    } finally {
      this.busy.set(null);
    }
  }

  start(r: RequestItem)   { this.act(r, { action: 'START', progressPct: 25 }, 'Task started'); }
  release(r: RequestItem) { this.act(r, { action: 'RELEASE' }, 'Released back to the pool'); }

  setProgress(r: RequestItem, pct: number) {
    this.act(r, { action: 'PROGRESS', progressPct: pct }, 'Progress saved');
  }

  /**
   * Deliberately offered while the task is still ASSIGNED, so the server can
   * refuse it. That refusal is the point: the lifecycle is enforced on the
   * server, not by hiding the button.
   */
  tryIllegalComplete(r: RequestItem) {
    this.act(r, { action: 'COMPLETE', hoursLogged: 1 }, 'Completed');
  }

  openComplete(r: RequestItem) {
    this.completing.set(r);
    this.hours = 1;
    this.notes = '';
  }

  async confirmComplete(): Promise<void> {
    const r = this.completing();
    if (!r) return;
    await this.act(
      r,
      { action: 'COMPLETE', hoursLogged: this.hours, completionNotes: this.notes || undefined },
      'Task completed',
    );
    this.completing.set(null);
  }
}
