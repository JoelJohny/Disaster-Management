import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api, type ApiError } from '../../core/services/api';
import { AuthStore } from '../../core/services/auth.store';
import { ReferenceStore } from '../../core/services/reference.store';
import { ToastService } from '../../core/services/toast';
import { label } from '../../shared/ui';

@Component({
  selector: 'app-user-profile',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss',
})
export class UserProfile {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(Api);
  private toast = inject(ToastService);
  readonly auth = inject(AuthStore);
  readonly ref = inject(ReferenceStore);

  readonly busy = signal(false);
  readonly label = label;

  readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/)]],
    district: ['', Validators.required],
  });

  constructor() {
    this.ref.load();
    const u = this.auth.user();
    if (u) this.form.patchValue({ fullName: u.fullName, phone: u.phone, district: u.district });
  }

  invalid(name: string): boolean {
    const c = this.form.get(name)!;
    return c.invalid && c.touched;
  }

  errorFor(name: string): string {
    const c = this.form.get(name)!;
    if (c.hasError('server')) return c.getError('server');
    if (c.hasError('required')) return 'This field is required';
    if (c.hasError('minlength')) return 'Too short';
    if (c.hasError('pattern')) return 'Enter a valid Indian mobile number';
    return '';
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        this.api.patch<{ user: any }>('/auth/me', this.form.getRawValue()),
      );
      this.auth.setUser(r.user);
      this.toast.success('Profile saved', 'Your details have been updated.');
    } catch (e) {
      const err = e as ApiError;
      if (err.fieldErrors) {
        for (const [k, m] of Object.entries(err.fieldErrors)) this.form.get(k)?.setErrors({ server: m });
      }
      this.toast.error('Could not save', err.message);
    } finally {
      this.busy.set(false);
    }
  }
}
