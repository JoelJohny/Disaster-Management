import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../../core/services/api';
import { AuthStore } from '../../../core/services/auth.store';
import { RequestsStore, type RequestItem } from '../../../core/services/requests.store';
import { StatePanel } from '../../../shared/state-panel';
import { STATUS_CLASS, URGENCY_CLASS, label, when, distance } from '../../../shared/ui';

interface VolunteerDash {
  availableNearby: number;
  activeTasks: number;
  completedCount: number;
  hoursLogged: number;
  ratingAvg: number | null;
  ratingCount: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  serviceRadiusKm: number;
  skills: string[];
}

@Component({
  selector: 'app-volunteer-dashboard',
  imports: [RouterLink, StatePanel],
  templateUrl: './volunteer-dashboard.html',
  styleUrl: './volunteer-dashboard.scss',
})
export class VolunteerDashboard {
  private api = inject(Api);
  private store = inject(RequestsStore);
  readonly auth = inject(AuthStore);

  readonly data = signal<VolunteerDash | null>(null);
  readonly urgent = signal<RequestItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly URGENCY_CLASS = URGENCY_CLASS;
  readonly distance = distance;
  readonly label = label;
  readonly when = when;

  constructor() { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [dash, pool] = await Promise.all([
        firstValueFrom(this.api.get<VolunteerDash>('/dashboard/volunteer')),
        firstValueFrom(this.api.get<any>('/requests', {
          scope: 'available', sort: 'urgency', pageSize: 3,
        })),
      ]);
      this.data.set(dash);
      this.urgent.set(pool.items ?? []);
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load your dashboard.');
    } finally {
      this.loading.set(false);
    }
  }
}
