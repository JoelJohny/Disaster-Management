import { Component, Input } from '@angular/core';

/**
 * Loading / error / empty, in one place, because every list screen needs all
 * three and none of them existed anywhere in this application before.
 */
@Component({
  selector: 'app-state-panel',
  imports: [],
  template: `
    @if (loading) {
      <div class="flex flex-col items-center justify-center py-14 text-gray-500">
        <div class="h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-blue-700"></div>
        <p class="mt-3 text-sm">{{ loadingText }}</p>
      </div>
    } @else if (error) {
      <div class="flex flex-col items-center justify-center py-14 px-5 text-center">
        <div class="text-3xl">⚠</div>
        <p class="mt-2 font-semibold text-gray-900">Could not load this</p>
        <p class="mt-1 max-w-md text-sm text-gray-600">{{ error }}</p>
        @if (onRetry) {
          <button type="button" (click)="onRetry()"
                  class="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Try again
          </button>
        }
      </div>
    } @else if (empty) {
      <div class="flex flex-col items-center justify-center py-14 px-5 text-center">
        <div class="text-3xl opacity-40">{{ emptyIcon }}</div>
        <p class="mt-2 font-semibold text-gray-700">{{ emptyTitle }}</p>
        <p class="mt-1 max-w-md text-sm text-gray-500">{{ emptyText }}</p>
      </div>
    }
  `,
})
export class StatePanel {
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() empty = false;
  @Input() loadingText = 'Loading…';
  @Input() emptyIcon = '☰';
  @Input() emptyTitle = 'Nothing here yet';
  @Input() emptyText = '';
  @Input() onRetry?: () => void;
}
