import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RequestsStore } from '../../../core/services/requests.store';
import { ReferenceStore } from '../../../core/services/reference.store';
import { AuthStore } from '../../../core/services/auth.store';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import { URGENCY_CLASS, label, when, distance } from '../../../shared/ui';
import type { ApiError } from '../../../core/services/api';

@Component({
  selector: 'app-available-requests',
  imports: [StatePanel],
  templateUrl: './available-requests.html',
  styleUrl: './available-requests.scss',
})
export class AvailableRequests {
  readonly store = inject(RequestsStore);
  readonly ref = inject(ReferenceStore);
  readonly auth = inject(AuthStore);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly sort = signal<'urgency' | 'distance' | 'newest'>('urgency');
  readonly category = signal<string>('');
  readonly claiming = signal<number | null>(null);

  readonly URGENCY_CLASS = URGENCY_CLASS;
  readonly distance = distance;
  readonly label = label;
  readonly when = when;

  constructor() {
    this.ref.load();
    this.load();
  }

  load(): void {
    this.store.load('available', {
      sort: this.sort(),
      categoryCode: this.category() || undefined,
      pageSize: 50,
    });
  }

  setSort(s: 'urgency' | 'distance' | 'newest'): void { this.sort.set(s); this.load(); }
  setCategory(c: string): void { this.category.set(c); this.load(); }

  /**
   * The atomic claim, from the client's side.
   *
   * Two volunteers pressing this within the same second is the case the whole
   * design exists for: exactly one gets 201, the other gets 409 naming the
   * winner. There is no optimistic update here — we wait for the server,
   * because guessing the outcome is precisely what must not happen.
   */
  async claim(id: number, reference: string): Promise<void> {
    if (this.claiming() !== null) return;
    this.claiming.set(id);
    try {
      await this.store.claim(id);
      this.toast.success('Request accepted', `${reference} is yours. Contact details are now visible.`);
      this.router.navigate(['/requests', id]);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'ALREADY_CLAIMED') {
        this.toast.error('Too late', err.message);
      } else {
        this.toast.error('Could not accept', err.message);
      }
      this.load();   // the card should disappear either way
    } finally {
      this.claiming.set(null);
    }
  }
}
