import { Component, inject } from '@angular/core';
import { ToastService } from '../core/services/toast';

@Component({
  selector: 'app-toasts',
  imports: [],
  template: `
    <div class="fixed bottom-5 right-5 z-[80] flex flex-col gap-2">
      @for (t of toast.items(); track t.id) {
        <div class="min-w-[260px] max-w-sm rounded-lg border bg-white px-4 py-3 shadow-lg border-l-4"
             [class.border-l-blue-700]="t.kind === 'info'"
             [class.border-l-green-700]="t.kind === 'success'"
             [class.border-l-red-700]="t.kind === 'error'"
             role="status">
          <div class="flex items-start gap-3">
            <div class="flex-1">
              <p class="text-sm font-semibold text-gray-900">{{ t.title }}</p>
              @if (t.message) { <p class="mt-0.5 text-sm text-gray-600">{{ t.message }}</p> }
            </div>
            <button type="button" (click)="toast.dismiss(t.id)"
                    class="text-gray-400 hover:text-gray-700" aria-label="Dismiss">✕</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  toast = inject(ToastService);
}
