import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div class="text-center max-w-md">
        <p class="text-6xl font-bold text-blue-800">404</p>
        <h1 class="mt-3 text-2xl font-semibold text-gray-900">Page not found</h1>
        <p class="mt-2 text-gray-600">
          The page you are looking for does not exist or has been moved.
        </p>
        <a routerLink="/"
           class="mt-6 inline-block rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900">
          Back to dashboard
        </a>
      </div>
    </div>
  `,
})
export class NotFound {}
