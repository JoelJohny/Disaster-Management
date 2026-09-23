import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';
import { NotificationStore } from '../../core/services/notifications.store';
import { ReferenceStore } from '../../core/services/reference.store';
import { when } from '../../shared/ui';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  @Input() isMobile = false;
  @Output() menuToggle = new EventEmitter<void>();

  readonly auth = inject(AuthStore);
  readonly notifications = inject(NotificationStore);
  readonly ref = inject(ReferenceStore);
  private router = inject(Router);
  private host = inject(ElementRef);

  readonly bellOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly when = when;

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.host.nativeElement.contains(e.target)) {
      this.bellOpen.set(false);
      this.menuOpen.set(false);
    }
  }

  toggleBell(): void {
    const next = !this.bellOpen();
    this.bellOpen.set(next);
    this.menuOpen.set(false);
    if (next) {
      this.notifications.refresh().then(() => this.notifications.markAllRead());
    }
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
    this.bellOpen.set(false);
  }

  open(url: string | null): void {
    this.bellOpen.set(false);
    if (url) this.router.navigateByUrl(url);
  }

  logout(): void { this.auth.logout(); }
}
