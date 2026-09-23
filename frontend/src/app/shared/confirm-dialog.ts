import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-5"
           (click)="onBackdrop($event)">
        <div class="w-full max-w-md rounded-xl bg-white shadow-xl" role="dialog" aria-modal="true">
          <div class="border-b border-gray-200 px-5 py-4">
            <h3 class="text-base font-semibold text-gray-900">{{ title }}</h3>
          </div>
          <div class="px-5 py-4 text-sm text-gray-600">
            <ng-content></ng-content>
          </div>
          <div class="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
            <button type="button" (click)="cancelled.emit()"
                    class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              {{ cancelLabel }}
            </button>
            <button type="button" (click)="confirmed.emit()" [disabled]="busy"
                    class="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    [class]="danger ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-800 hover:bg-blue-900'">
              {{ busy ? 'Working…' : confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  @Input() open = false;
  @Input() title = 'Are you sure?';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() danger = false;
  @Input() busy = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.cancelled.emit();
  }
}
