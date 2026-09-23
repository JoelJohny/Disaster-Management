import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { AuthStore } from '../services/auth.store';
import type { Role } from '../services/auth.store';

/** Signed in, or bounce to login remembering where they were heading. */
export const authGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  const target = '/' + segments.map(s => s.path).join('/');
  return router.createUrlTree(['/auth/login'], { queryParams: { redirect: target } });
};

/** Already signed in? The login page is not for you. */
export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.parseUrl(auth.home()) : true;
};

/**
 * Role gate. Note this is CONVENIENCE, not security — it stops a user
 * navigating somewhere useless. The real enforcement is on the server, which
 * checks the role on every request regardless of what the client renders.
 */
export const roleGuard = (...roles: Role[]): CanMatchFn => () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return roles.includes(auth.role()!) ? true : router.createUrlTree(['/forbidden']);
};
