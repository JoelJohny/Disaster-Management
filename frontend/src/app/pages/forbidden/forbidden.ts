import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';

@Component({
  selector: 'app-forbidden',
  imports: [],
  template: `
    <div class="mx-auto max-w-lg py-16 text-center">
      <p class="text-6xl font-bold text-red-700">403</p>
      <h1 class="mt-3 text-2xl font-semibold text-gray-900">Forbidden</h1>
      <p class="mt-2 text-gray-600">You do not have permission to view this page.</p>

      <div class="mt-7 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-left text-sm text-gray-700">
        <p class="font-semibold text-blue-900">Why you are seeing this</p>
        <p class="mt-1">
          Your role does not allow this page. The hidden menu item is only convenience —
          the server checks your role on every single request, so an address typed
          directly into the bar is refused just the same.
        </p>
      </div>

      <button type="button" (click)="goHome()"
              class="mt-7 rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900">
        Back to my dashboard
      </button>
    </div>
  `,
})
export class Forbidden {
  private auth = inject(AuthStore);
  private router = inject(Router);
  goHome() { this.router.navigateByUrl(this.auth.home()); }
}
