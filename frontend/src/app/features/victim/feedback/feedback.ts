import { Component, Input, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RequestsStore, type RequestItem } from '../../../core/services/requests.store';
import { ToastService } from '../../../core/services/toast';
import { StatePanel } from '../../../shared/state-panel';
import type { ApiError } from '../../../core/services/api';

@Component({
  selector: 'app-feedback',
  imports: [ReactiveFormsModule, StatePanel],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss',
})
export class Feedback {
  private fb = inject(NonNullableFormBuilder);
  private store = inject(RequestsStore);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly request = signal<RequestItem | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly hovered = signal(0);

  readonly form = this.fb.group({
    rating: [0, [Validators.required, Validators.min(1)]],
    comments: [''],
    contactPermission: [false],
  });

  /** Bound from /victim/feedback/:requestId by withComponentInputBinding(). */
  @Input() set requestId(value: string) { this.fetch(value); }

  private async fetch(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.store.getOne(id);
      this.request.set(r.request);
      if (r.request.status !== 'COMPLETED') {
        this.error.set('You can only rate a request once it has been completed.');
      } else if (r.request.hasFeedback) {
        this.error.set('You have already rated this request. Only one rating is allowed.');
      }
    } catch (e) {
      this.error.set((e as ApiError).message ?? 'Could not load this request.');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void { history.back(); }

  setRating(n: number): void { this.form.controls.rating.setValue(n); }

  /** Keyboard support: the stars are a radio group, not five bare buttons. */
  onKey(e: KeyboardEvent, n: number): void {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault(); this.setRating(Math.min(5, n + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault(); this.setRating(Math.max(1, n - 1));
    }
  }

  async submit(): Promise<void> {
    const r = this.request();
    if (!r || this.form.invalid) {
      this.toast.error('Choose a rating', 'Select between one and five stars.');
      return;
    }
    this.busy.set(true);
    try {
      await this.store.feedback(r.id, this.form.getRawValue());
      this.toast.success('Thank you', 'Your rating has been recorded.');
      this.router.navigate(['/requests', r.id]);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'DUPLICATE_FEEDBACK') {
        // The UNIQUE index refused it, not a check in the service.
        this.error.set('You have already rated this request. Only one rating is allowed.');
      }
      this.toast.error('Could not submit', err.message);
    } finally {
      this.busy.set(false);
    }
  }
}
