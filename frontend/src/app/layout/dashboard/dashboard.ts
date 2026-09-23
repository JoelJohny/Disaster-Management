import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../core/services/api';
import { StatePanel } from '../../shared/state-panel';
import { STATUS_CLASS, label, when } from '../../shared/ui';

interface AdminDash {
  kpis: {
    openRequests: number;
    criticalUnassigned: number;
    resolvedThisWeek: number;
    volunteersOnline: number;
  };
  trend: { date: string; count: number }[];
  byType: { code: string; name: string; status: string; n: number }[];
  activity: {
    id: number; reference: string; status: string;
    actorName: string; actorRole: string; occurredAt: string;
  }[];
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatePanel],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private api = inject(Api);

  readonly data = signal<AdminDash | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly label = label;
  readonly when = when;

  /** Bar heights as percentages of the tallest day. */
  readonly trendBars = computed(() => {
    const t = this.data()?.trend ?? [];
    const max = Math.max(1, ...t.map(d => d.count));
    return t.map(d => ({
      ...d,
      pct: Math.round((d.count / max) * 100),
      day: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2),
    }));
  });

  constructor() { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.data.set(await firstValueFrom(this.api.get<AdminDash>('/dashboard/admin')));
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load the dashboard.');
    } finally {
      this.loading.set(false);
    }
  }
}
