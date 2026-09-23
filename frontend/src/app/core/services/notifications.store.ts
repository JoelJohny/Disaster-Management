import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from './api';

export interface Notification {
  id: number; type: string; title: string; body: string;
  targetUrl: string | null; readAt: string | null; createdAt: string;
}

/**
 * Polling, not WebSockets.
 *
 * Correctness here comes from a database constraint, not from a socket, so a
 * 20-second poll is sufficient and costs a fraction of the complexity. The
 * upgrade path to server-sent events is one day of work and no data change.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private api = inject(Api);

  readonly items = signal<Notification[]>([]);
  readonly unread = signal(0);
  readonly hasUnread = computed(() => this.unread() > 0);

  private timer: ReturnType<typeof setInterval> | null = null;

  async refresh(): Promise<void> {
    try {
      const r = await firstValueFrom(this.api.get<any>('/notifications'));
      this.items.set(r.items ?? []);
      this.unread.set(r.unread ?? 0);
    } catch { /* a failed poll is not worth surfacing */ }
  }

  startPolling(ms = 20_000): void {
    this.refresh();
    this.stopPolling();
    this.timer = setInterval(() => this.refresh(), ms);
  }

  stopPolling(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  async markAllRead(): Promise<void> {
    await firstValueFrom(this.api.post('/notifications/read'));
    this.unread.set(0);
    this.items.update(l => l.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }
}
