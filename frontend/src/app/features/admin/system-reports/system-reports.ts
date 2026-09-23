import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import { label } from '../../../shared/ui';

interface Row { category: string; status: string; count: number; }

const STATUSES = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

@Component({
  selector: 'app-system-reports',
  imports: [StatePanel],
  templateUrl: './system-reports.html',
  styleUrl: './system-reports.scss',
})
export class SystemReports {
  private api = inject(Api);
  private toast = inject(ToastService);

  readonly rows = signal<Row[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly downloading = signal(false);

  readonly statuses = STATUSES;
  readonly label = label;

  /** Pivot the flat (category, status, count) rows into a cross-tab. */
  readonly pivot = computed(() => {
    const byCat = new Map<string, Record<string, number>>();
    for (const r of this.rows()) {
      if (!byCat.has(r.category)) byCat.set(r.category, {});
      byCat.get(r.category)![r.status] = r.count;
    }
    return [...byCat.entries()].map(([category, counts]) => ({
      category,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }));
  });

  readonly grandTotal = computed(() => this.pivot().reduce((a, r) => a + r.total, 0));

  columnTotal(status: string): number {
    return this.pivot().reduce((a, r) => a + (r.counts[status] ?? 0), 0);
  }

  constructor() { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.get<any>('/reports/request-summary'));
      this.rows.set(r.items ?? []);
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load the report.');
    } finally {
      this.loading.set(false);
    }
  }

  async downloadCsv(): Promise<void> {
    this.downloading.set(true);
    try {
      const blob = await firstValueFrom(
        this.api.getBlob('/reports/request-summary', { format: 'csv' }),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'request-summary.csv';
      a.click();
      URL.revokeObjectURL(url);
      this.toast.success('Downloaded', 'request-summary.csv');
    } catch (e) {
      this.toast.error('Could not download', (e as ApiError).message);
    } finally {
      this.downloading.set(false);
    }
  }
}
