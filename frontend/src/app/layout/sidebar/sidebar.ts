import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';

interface NavItem { label: string; icon: string; route: string; }
interface NavSection { heading: string; items: NavItem[]; }

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LowerCasePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  @Input() isVisible = true;
  @Input() isMobile = false;
  @Output() toggle = new EventEmitter<void>();

  readonly auth = inject(AuthStore);

  /**
   * The menu is filtered by role. This is convenience only — hiding a link does
   * not protect anything. The route guard stops the navigation and the server
   * refuses the request regardless of what is rendered here.
   */
  readonly sections = computed<NavSection[]>(() => {
    switch (this.auth.role()) {
      case 'VICTIM':
        return [
          { heading: 'Relief', items: [
            { label: 'Dashboard',    icon: '⌂', route: '/victim/dashboard' },
            { label: 'Request Help', icon: '✚', route: '/victim/submit-request' },
            { label: 'My Requests',  icon: '☰', route: '/victim/my-requests' },
          ]},
          { heading: 'Account', items: [
            { label: 'My Profile', icon: '◍', route: '/profile' },
          ]},
        ];

      case 'VOLUNTEER':
        return [
          { heading: 'Volunteer', items: [
            { label: 'Dashboard',          icon: '⌂', route: '/volunteer/dashboard' },
            { label: 'Available Requests', icon: '◎', route: '/volunteer/available-tasks' },
            { label: 'My Tasks',           icon: '☑', route: '/volunteer/my-tasks' },
          ]},
          { heading: 'Account', items: [
            { label: 'My Profile', icon: '◍', route: '/profile' },
          ]},
        ];

      case 'ADMIN':
        return [
          { heading: 'Overview', items: [
            { label: 'Dashboard', icon: '⌂', route: '/dashboard' },
          ]},
          { heading: 'Management', items: [
            { label: 'User Management', icon: '⚇', route: '/admin/user-management' },
            { label: 'All Requests',    icon: '☰', route: '/admin/all-requests' },
            { label: 'Disaster Events', icon: '◈', route: '/admin/disaster-management' },
          ]},
          { heading: 'System', items: [
            { label: 'Reports', icon: '▤', route: '/admin/system-reports' },
          ]},
          { heading: 'Account', items: [
            { label: 'My Profile', icon: '◍', route: '/profile' },
          ]},
        ];

      default:
        return [];
    }
  });

  onNavigate(): void {
    if (this.isMobile) this.toggle.emit();
  }

  logout(): void { this.auth.logout(); }
}
