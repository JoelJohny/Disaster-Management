import { inject } from '@angular/core';
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../services/auth.store';

/**
 * A 401 anywhere means the session has gone (expired, or revoked by a role
 * change). Clear local state once, centrally, rather than in every component.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((e: unknown) => {
      if (e instanceof HttpErrorResponse && e.status === 401 && !req.url.includes('/auth/')) {
        auth.setUser(null);
        router.navigate(['/auth/login'], { queryParams: { expired: 1 } });
      }
      return throwError(() => e);
    }),
  );
};
