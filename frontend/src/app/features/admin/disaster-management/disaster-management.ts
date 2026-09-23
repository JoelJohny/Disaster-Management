import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../../core/services/api';
import { ReferenceStore, type Disaster } from '../../../core/services/reference.store';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import { STATUS_CLASS, label } from '../../../shared/ui';

@Component({
  selector: 'app-disaster-management',
  imports: [ReactiveFormsModule, StatePanel, DatePipe],
  templateUrl: './disaster-management.html',
  styleUrl: './disaster-management.scss',
})
export class DisasterManagement {
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);
  private toast = inject(ToastService);
  readonly ref = inject(ReferenceStore);

  readonly items = signal<Disaster[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);
  readonly busy = signal(false);

  readonly STATUS_CLASS = STATUS_CLASS;
  readonly label = label;

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    type: ['Flood', Validators.required],
    severity: ['HIGH', Validators.required],
    district: ['', Validators.required],
    radiusKm: [25, [Validators.required, Validators.min(1), Validators.max(200)]],
    helplineNumber: ['1077'],
    description: [''],
    startDate: ['', Validators.required],
    endDate: [''],
  });

  constructor() { this.ref.load(); this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.get<any>('/disasters'));
      this.items.set(r.items ?? []);
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load events.');
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.creating.set(true);
    this.form.patchValue({ startDate: new Date().toISOString().slice(0, 10) });
  }

  invalid(name: string): boolean {
    const c = this.form.get(name)!;
    return c.invalid && c.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(this.api.post('/disasters', {
        ...v,
        endDate: v.endDate || null,
        helplineNumber: v.helplineNumber || undefined,
        description: v.description || undefined,
      }));
      this.toast.success('Event created', v.title);
      this.creating.set(false);
      this.form.reset({ type: 'Flood', severity: 'HIGH', radiusKm: 25, helplineNumber: '1077' });
      this.load();
    } catch (e) {
      this.toast.error('Could not create event', (e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }
}
