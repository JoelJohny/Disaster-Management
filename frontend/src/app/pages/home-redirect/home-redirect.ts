import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';

/** Sends "/" to whichever dashboard belongs to the signed-in role. */
@Component({ selector: 'app-home-redirect', imports: [], template: '' })
export class HomeRedirect {
  constructor() {
    const auth = inject(AuthStore);
    inject(Router).navigateByUrl(auth.home(), { replaceUrl: true });
  }
}
