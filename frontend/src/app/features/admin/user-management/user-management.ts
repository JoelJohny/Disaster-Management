import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../../core/services/api';
import { AuthStore } from '../../../core/services/auth.store';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import { STATUS_CLASS, label, when } from '../../../shared/ui';

interface AdminUser {
  id: number; fullName: string; email: string; phone: string; role: string;
  district: string; isActive: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  completedCount: number | null; ratingAvg: number | null; createdAt: string;
}

@Component({
  selector: 'app-user-management',
  imports: [FormsModule, StatePanel],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement {
  private api = inject(Api);
  private toast = inject(ToastService);
  readonly auth = inject(AuthStore);

  readonly users = signal<AdminUser[]>([]);
  readonly pending = signal<AdminUser[]>([]);
  readonly counts = signal<Record<string, number>>({});
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal<number | null>(null);

  readonly roleFilter = signal('');
  search = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly label = label;
  readonly when = when;

  constructor() { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [all, pend] = await Promise.all([
        firstValueFrom(this.api.get<any>('/users', {
          role: this.roleFilter() || undefined,
          q: this.search || undefined,
          pageSize: 50,
        })),
        firstValueFrom(this.api.get<any>('/users', { approvalStatus: 'PENDING', pageSize: 20 })),
      ]);
      this.users.set(all.items ?? []);
      this.total.set(all.total ?? 0);
      this.counts.set(all.counts ?? {});
      this.pending.set(pend.items ?? []);
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load users.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Debounced so a search does not fire a request on every keystroke. */
  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  setRole(r: string): void { this.roleFilter.set(r); this.load(); }

  async decide(u: AdminUser, decision: 'APPROVE' | 'REJECT'): Promise<void> {
    this.busy.set(u.id);
    try {
      await firstValueFrom(this.api.post(`/users/${u.id}/volunteer-approval`, { decision }));
      this.toast.success(
        decision === 'APPROVE' ? 'Volunteer approved' : 'Application rejected',
        decision === 'APPROVE' ? `${u.fullName} can now accept requests.` : u.fullName,
      );
      this.load();
    } catch (e) {
      this.toast.error('Could not update', (e as ApiError).message);
    } finally {
      this.busy.set(null);
    }
  }

  async setActive(u: AdminUser, isActive: boolean): Promise<void> {
    this.busy.set(u.id);
    try {
      await firstValueFrom(this.api.post(`/users/${u.id}/active`, { isActive }));
      this.toast.success(isActive ? 'Account activated' : 'Account deactivated', u.fullName);
      this.load();
    } catch (e) {
      const err = e as ApiError;
      // SELF_DEACTIVATE and LAST_ADMIN are the two guardrails.
      this.toast.error('Blocked', err.message);
    } finally {
      this.busy.set(null);
    }
  }
}
