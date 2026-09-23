import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RequestsStore } from '../../../core/services/requests.store';
import { ReferenceStore } from '../../../core/services/reference.store';
import { AuthStore } from '../../../core/services/auth.store';
import { ToastService } from '../../../core/services/toast';
import type { ApiError } from '../../../core/services/api';

const DRAFT_KEY = 'drms.request.draft';

/**
 * The three-step wizard, as ONE FormGroup of three nested groups.
 *
 * Because it is one group, `nextStep()` can gate on `group.valid` for just the
 * current step, and the whole value mirrors to sessionStorage on every change —
 * so a refresh half way through does not lose what has been typed.
 *
 * The API body is FLAT while this form is NESTED, so server field errors are
 * mapped back through SERVER_PATH. Without that map, `form.get('peopleCount')`
 * returns null and every server-side error is silently discarded.
 */
const SERVER_PATH: Record<string, string> = {
  categoryCode: 'details.categoryCode',
  urgency:      'details.urgency',
  district:     'location.district',
  locationText: 'location.locationText',
  peopleCount:  'location.peopleCount',
  description:  'describe.description',
  contactPhone: 'describe.contactPhone',
};

@Component({
  selector: 'app-request',
  imports: [ReactiveFormsModule],
  templateUrl: './request.html',
  styleUrl: './request.scss',
})
export class SubmitRequest {
  private fb = inject(NonNullableFormBuilder);
  private store = inject(RequestsStore);
  private toast = inject(ToastService);
  private router = inject(Router);
  readonly ref = inject(ReferenceStore);
  readonly auth = inject(AuthStore);

  readonly step = signal(1);
  readonly busy = signal(false);
  readonly tried = signal(false);
  readonly banner = signal<string | null>(null);

  readonly form = this.fb.group({
    details: this.fb.group({
      categoryCode: ['', Validators.required],
      urgency: ['', Validators.required],
    }),
    location: this.fb.group({
      district: ['', Validators.required],
      locationText: ['', [Validators.required, Validators.minLength(3)]],
      peopleCount: [1, [Validators.required, Validators.min(1), Validators.max(999)]],
    }),
    describe: this.fb.group({
      description: ['', [Validators.required, Validators.minLength(10)]],
      contactPhone: [''],
    }),
  });

  constructor() {
    this.ref.load();
    this.restoreDraft();
    // Mirror to sessionStorage so a refresh mid-form loses nothing.
    this.form.valueChanges.subscribe(v => {
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch { /* private mode */ }
    });
  }

  private restoreDraft(): void {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) this.form.patchValue(JSON.parse(raw));
    } catch { /* ignore a corrupt draft */ }
    if (!this.form.controls.location.controls.district.value) {
      this.form.controls.location.controls.district.setValue(this.auth.user()?.district ?? '');
    }
  }

  private groupFor(step: number) {
    return step === 1 ? this.form.controls.details
         : step === 2 ? this.form.controls.location
         : this.form.controls.describe;
  }

  invalid(path: string): boolean {
    const c = this.form.get(path)!;
    return c.invalid && (c.touched || this.tried());
  }

  errorFor(path: string): string {
    const c = this.form.get(path)!;
    if (c.hasError('server')) return c.getError('server');
    if (c.hasError('required')) {
      if (path.endsWith('categoryCode')) return 'Choose the kind of help you need';
      if (path.endsWith('urgency')) return 'Tell us how urgent this is';
      if (path.endsWith('district')) return 'Select your district';
      if (path.endsWith('locationText')) return 'Tell us where you are';
      if (path.endsWith('description')) return 'Please describe your situation';
      return 'This field is required';
    }
    if (c.hasError('minlength')) {
      return path.endsWith('description')
        ? 'Please give a little more detail (at least 10 characters)'
        : 'Too short';
    }
    if (c.hasError('min')) return 'At least 1 person';
    if (c.hasError('max')) return 'That is more than this form can handle — please call the helpline';
    return '';
  }

  next(): void {
    this.tried.set(true);
    const g = this.groupFor(this.step());
    if (g.invalid) {
      g.markAllAsTouched();
      this.toast.error('Check this step', 'Some required answers are missing.');
      return;
    }
    this.tried.set(false);
    this.step.update(s => Math.min(3, s + 1));
  }

  back(): void { this.step.update(s => Math.max(1, s - 1)); }

  async submit(): Promise<void> {
    this.tried.set(true);
    this.banner.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Check the form', 'Some required answers are missing.');
      return;
    }

    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const payload: Record<string, unknown> = {
        categoryCode: v.details.categoryCode,
        urgency: v.details.urgency,
        district: v.location.district,
        locationText: v.location.locationText,
        peopleCount: v.location.peopleCount,
        description: v.describe.description,
      };
      // Optional: the server falls back to the account's own number.
      if (v.describe.contactPhone?.trim()) payload['contactPhone'] = v.describe.contactPhone.trim();

      const r = await this.store.create(payload);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      this.toast.success('Request submitted', `${r.reference} is now visible to nearby volunteers.`);
      this.router.navigate(['/requests', r.id]);
    } catch (e) {
      const err = e as ApiError;
      if (err.fieldErrors) {
        for (const [field, msg] of Object.entries(err.fieldErrors)) {
          const path = SERVER_PATH[field] ?? field;
          this.form.get(path)?.setErrors({ server: msg });
        }
        this.banner.set('Please correct the highlighted answers.');
        // Jump back to whichever step now holds an error.
        for (const s of [1, 2, 3]) if (this.groupFor(s).invalid) { this.step.set(s); break; }
      } else {
        this.banner.set(err.message ?? 'Could not submit your request.');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
