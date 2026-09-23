import {
  ApplicationConfig, provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection, provideAppInitializer, inject, LOCALE_ID,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthStore } from './core/services/auth.store';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    // withComponentInputBinding is what lets /victim/feedback/:requestId
    // arrive as an @Input on the component instead of an ActivatedRoute dance.
    provideRouter(routes, withComponentInputBinding()),

    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),

    { provide: LOCALE_ID, useValue: 'en-IN' },

    // Restore the session BEFORE the router runs. Without this every guard
    // bounces a refreshed user to the login screen.
    provideAppInitializer(() => inject(AuthStore).restore()),
  ],
};
