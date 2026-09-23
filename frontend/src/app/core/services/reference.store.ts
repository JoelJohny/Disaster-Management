import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from './api';

export interface Category { id: number; code: string; name: string; iconKey: string; colorKey: string; }
export interface Disaster {
  id: number; title: string; type: string; severity: string; district: string;
  radiusKm: number; helplineNumber: string | null; description: string | null;
  startDate: string; endDate: string | null; state: 'UPCOMING' | 'ACTIVE' | 'PAST';
  requestCount?: number;
}

/**
 * Lookup data, fetched once per session and shared. One endpoint rather than
 * one per lookup, so a screen needs a single round trip before it can render
 * its dropdowns.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceStore {
  private api = inject(Api);

  readonly categories = signal<Category[]>([]);
  readonly districts = signal<string[]>([]);
  readonly skills = signal<{ id: number; code: string; name: string }[]>([]);
  readonly activeDisaster = signal<Disaster | null>(null);
  readonly loaded = signal(false);

  private inflight: Promise<void> | null = null;

  load(): Promise<void> {
    if (this.loaded()) return Promise.resolve();
    if (this.inflight) return this.inflight;

    this.inflight = firstValueFrom(this.api.get<any>('/reference'))
      .then(r => {
        this.categories.set(r.categories ?? []);
        this.districts.set(r.districts ?? []);
        this.skills.set(r.skills ?? []);
        this.activeDisaster.set(r.activeDisaster ?? null);
        this.loaded.set(true);
      })
      .catch(() => { /* dropdowns fall back to empty; the page still renders */ })
      .finally(() => { this.inflight = null; });

    return this.inflight;
  }

  categoryName(code: string): string {
    return this.categories().find(c => c.code === code)?.name ?? code;
  }
}
