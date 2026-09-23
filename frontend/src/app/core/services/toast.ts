import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly _items = signal<Toast[]>([]);
  readonly items = this._items.asReadonly();

  private push(kind: Toast['kind'], title: string, message?: string) {
    const t: Toast = { id: ++this.seq, kind, title, message };
    this._items.update(list => [...list, t]);
    setTimeout(() => this.dismiss(t.id), 5000);
  }

  info(title: string, message?: string)    { this.push('info', title, message); }
  success(title: string, message?: string) { this.push('success', title, message); }
  error(title: string, message?: string)   { this.push('error', title, message); }

  dismiss(id: number) { this._items.update(l => l.filter(t => t.id !== id)); }
}
