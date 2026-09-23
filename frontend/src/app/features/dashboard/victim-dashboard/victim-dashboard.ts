import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../../core/services/api';
import { AuthStore } from '../../../core/services/auth.store';
import { RequestsStore, type RequestItem } from '../../../core/services/requests.store';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { STATUS_CLASS, label, when } from '../../../shared/ui';

interface VictimDash {
  openRequests: number;
  totalRequests: number;
  activeDisaster: {
    title: string; severity: string; state: string; district: string;
    helplineNumber: string | null; startDate: string;
  } | null;
  nearestCamp: {
    id: number; name: string; address: string; district: string;
    capacity: number; currentOccupancy: number; status: string;
    contactPhone: string | null; distanceKm: number;
  } | null;
}

@Component({
  selector: 'app-victim-dashboard',
  imports: [RouterLink, StatePanel, ConfirmDialog],
  templateUrl: './victim-dashboard.html',
  styleUrl: './victim-dashboard.scss',
})
export class VictimDashboard {
  private api = inject(Api);
  private store = inject(RequestsStore);
  private toast = inject(ToastService);
  private router = inject(Router);
  readonly auth = inject(AuthStore);

  readonly data = signal<VictimDash | null>(null);
  readonly recent = signal<RequestItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly sosOpen = signal(false);
  readonly sosBusy = signal(false);

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly label = label;
  readonly when = when;

  constructor() { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [dash, list] = await Promise.all([
        firstValueFrom(this.api.get<VictimDash>('/dashboard/victim')),
        firstValueFrom(this.api.get<any>('/requests', { scope: 'mine', pageSize: 3 })),
      ]);
      this.data.set(dash);
      this.recent.set(list.items ?? []);
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load your dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  campFullness(): number {
    const c = this.data()?.nearestCamp;
    return c ? Math.round((c.currentOccupancy / c.capacity) * 100) : 0;
  }

  /**
   * One tap, no form. Files a CRITICAL rescue request at the district the
   * account is registered in. The server falls back to the account's own phone
   * number, which is why this can post without a contact field.
   */
  async sendSos(): Promise<void> {
    this.sosBusy.set(true);
    try {
      const r = await this.store.create({
        categoryCode: 'RESCUE',
        urgency: 'CRITICAL',
        district: this.auth.user()!.district,
        locationText: 'SOS raised from dashboard — registered address',
        peopleCount: 1,
        description: 'Emergency SOS raised from the victim dashboard. No further detail was given.',
      });
      this.sosOpen.set(false);
      this.toast.error('SOS sent', `${r.reference} was filed as a critical rescue request.`);
      this.router.navigate(['/requests', r.id]);
    } catch (e) {
      this.toast.error('Could not send SOS', (e as ApiError).message);
    } finally {
      this.sosBusy.set(false);
    }
  }
}
