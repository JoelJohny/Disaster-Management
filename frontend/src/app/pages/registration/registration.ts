import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';
import { ReferenceStore } from '../../core/services/reference.store';
import type { ApiError } from '../../core/services/api';

/** Cross-field validator: the two password boxes must agree. */
const passwordsMatch = (g: AbstractControl): ValidationErrors | null =>
  g.get('password')!.value === g.get('confirmPassword')!.value ? null : { mismatch: true };

@Component({
  selector: 'app-registration',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registration.html',
  styleUrl: './registration.scss',
})
export class Registration {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthStore);
  private router = inject(Router);
  readonly ref = inject(ReferenceStore);

  readonly busy = signal(false);
  readonly submitted = signal(false);
  readonly banner = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/)]],
      district: ['', [Validators.required]],
      role: ['VICTIM' as 'VICTIM' | 'VOLUNTEER', [Validators.required]],
      password: ['', [
        Validators.required, Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
      ]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatch },
  );

  constructor() { this.ref.load(); }

  invalid(name: string): boolean {
    const c = this.form.get(name)!;
    return c.invalid && (c.touched || this.submitted());
  }

  get mismatch(): boolean {
    return this.form.hasError('mismatch') &&
      (this.form.controls.confirmPassword.touched || this.submitted());
  }

  errorFor(name: string): string {
    const c = this.form.get(name)!;
    if (c.hasError('server')) return c.getError('server');
    if (c.hasError('required')) return 'This field is required';
    if (c.hasError('requiredTrue')) return 'You must accept the terms to continue';
    if (c.hasError('email')) return 'Enter a valid email address';
    if (c.hasError('minlength')) {
      return name === 'password' ? 'At least 8 characters' : 'Too short';
    }
    if (c.hasError('pattern')) {
      return name === 'phone'
        ? 'Enter a valid Indian mobile number'
        : 'Include an uppercase letter, a lowercase letter and a digit';
    }
    return '';
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.banner.set(null);
    if (this.form.invalid || this.busy()) return;

    this.busy.set(true);
    try {
      await this.auth.register(this.form.getRawValue());
      await this.router.navigateByUrl(this.auth.home());
    } catch (e) {
      const err = e as ApiError;
      if (err.fieldErrors) {
        for (const [k, msg] of Object.entries(err.fieldErrors)) {
          this.form.get(k)?.setErrors({ server: msg });
        }
        this.banner.set('Please correct the highlighted fields.');
      } else {
        this.banner.set(err.message ?? 'Could not create your account.');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
