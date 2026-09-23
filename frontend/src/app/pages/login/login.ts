import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';
import type { ApiError } from '../../core/services/api';

/**
 * The pattern every form in this application copies:
 *   NonNullableFormBuilder → typed controls, no `| null` everywhere
 *   submitted signal       → errors appear on submit, not while still typing
 *   applyServerErrors      → server field errors land on the right control
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly submitted = signal(false);
  readonly banner = signal<string | null>(null);

  readonly expired = this.route.snapshot.queryParamMap.get('expired') === '1';

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Show an error only once the field has been touched or submit attempted. */
  invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  errorFor(name: 'email' | 'password'): string {
    const c = this.form.controls[name];
    if (c.hasError('required')) return name === 'email' ? 'Enter your email address' : 'Enter your password';
    if (c.hasError('email')) return 'Enter a valid email address';
    if (c.hasError('server')) return c.getError('server');
    return '';
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.banner.set(null);
    if (this.form.invalid || this.busy()) return;

    this.busy.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(redirect || this.auth.home());
    } catch (e) {
      const err = e as ApiError;
      if (err.fieldErrors) {
        for (const [k, msg] of Object.entries(err.fieldErrors)) {
          this.form.get(k)?.setErrors({ server: msg });
        }
      } else {
        this.banner.set(err.message ?? 'Could not sign you in.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Fills the form from the seeded accounts, so a demo does not involve typing. */
  useDemo(kind: 'victim' | 'volunteer' | 'admin'): void {
    const emails = {
      victim: 'priya@drms.local',
      volunteer: 'arun@drms.local',
      admin: 'admin@drms.local',
    };
    this.form.setValue({ email: emails[kind], password: 'Password@123' });
  }
}
