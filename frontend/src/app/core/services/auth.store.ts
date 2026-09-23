import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from './api';

export type Role = 'ADMIN' | 'VOLUNTEER' | 'VICTIM' | 'DONOR';

export interface CurrentUser {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  district: string;
  isActive: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

/**
 * The one place the signed-in user lives.
 *
 * Plain signals in an injectable service — the pattern every feature store in
 * this application copies. No NgRx: for a system this size it would be about
 * 200 lines of ceremony to replace roughly 30.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private api = inject(Api);
  private router = inject(Router);

  private readonly _user = signal<CurrentUser | null>(null);
  private readonly _ready = signal(false);

  readonly user = this._user.asReadonly();
  readonly ready = this._ready.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed(() => this._user()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'ADMIN');
  readonly isVolunteer = computed(() => this.role() === 'VOLUNTEER');
  readonly isVictim = computed(() => this.role() === 'VICTIM');
  readonly isApprovedVolunteer = computed(
    () => this.isVolunteer() && this._user()?.approvalStatus === 'APPROVED',
  );
  readonly initials = computed(() => {
    const n = this._user()?.fullName ?? '';
    return n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
  });

  /** Where this role belongs when it lands on "/". */
  readonly home = computed(() => {
    switch (this.role()) {
      case 'ADMIN':     return '/dashboard';
      case 'VOLUNTEER': return '/volunteer/dashboard';
      case 'VICTIM':    return '/victim/dashboard';
      default:          return '/auth/login';
    }
  });

  /**
   * Called once before the router starts. Without it, every guard would bounce
   * an already-signed-in user to the login page on a page refresh.
   */
  async restore(): Promise<void> {
    try {
      const r = await firstValueFrom(this.api.get<{ user: CurrentUser | null }>('/auth/me'));
      this._user.set(r.user);
    } catch {
      this._user.set(null);
    } finally {
      this._ready.set(true);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const r = await firstValueFrom(
      this.api.post<{ user: CurrentUser }>('/auth/login', { email, password }),
    );
    this._user.set(r.user);
  }

  async register(payload: Record<string, unknown>): Promise<void> {
    const r = await firstValueFrom(
      this.api.post<{ user: CurrentUser }>('/auth/register', payload),
    );
    this._user.set(r.user);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/auth/logout'));
    } finally {
      this._user.set(null);
      this.router.navigateByUrl('/auth/login');
    }
  }

  setUser(u: CurrentUser | null) { this._user.set(u); }
}
