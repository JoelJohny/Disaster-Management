import { Component, inject, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { Footer } from '../footer/footer';
import { Toasts } from '../../shared/toasts';
import { NotificationStore } from '../../core/services/notifications.store';
import { ReferenceStore } from '../../core/services/reference.store';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Header, Sidebar, Footer, Toasts],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout implements OnInit, OnDestroy {
  private notifications = inject(NotificationStore);
  private ref = inject(ReferenceStore);

  readonly sidebarOpen = signal(true);
  readonly isMobile = signal(false);

  ngOnInit(): void {
    this.onResize();
    this.ref.load();
    this.notifications.startPolling(20_000);
  }

  ngOnDestroy(): void {
    this.notifications.stopPolling();
  }

  @HostListener('window:resize')
  onResize(): void {
    const mobile = window.innerWidth < 1024;
    this.isMobile.set(mobile);
    this.sidebarOpen.set(!mobile);
  }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
}
