import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Router, NavigationEnd, IsActiveMatchOptions } from '@angular/router';
import { filter } from 'rxjs';
import { 
  // Admin Icons
  faTachometerAlt, faTasks, faUsersCog, faClipboardCheck, faCloudShowersHeavy, 
  faCogs, faChartBar,
  // Volunteer Icons
  faHandsHelping, faSearchLocation, faClipboardList,
  // Victim Icons
  faUserInjured, faFileSignature, faPlusCircle, faHistory, faStar,
  // Common Icons
  faUserCircle, faChevronDown, faChevronLeft, faChevronRight, faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';

interface MenuItem {
  label: string;
  icon: any;
  route?: string;
  isActive?: boolean;
  isExpanded?: boolean;
  children?: MenuItem[];
  section?: string; // For section headers
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule,FontAwesomeModule ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
@Input() isVisible = true;
  @Input() isMobile = false;
  @Output() toggle = new EventEmitter<void>();

  faTachometerAlt = faTachometerAlt;

  // Icon definitions
  faChevronDown = faChevronDown;
  faChevronLeft = faChevronLeft;
  faChevronRight = faChevronRight;
  faSignOutAlt = faSignOutAlt;

  // Menu items with routes matching your app.routes.ts
  menuItems: MenuItem[] = [
    // --- ADMIN SECTION ---
    {
      label: 'Admin', section: 'Admin',
      icon: undefined
    },
    { label: 'Dashboard', icon: faTachometerAlt, route: '/dashboard' },
    { 
      label: 'Management', 
      icon: faTasks, 
      isExpanded: false, 
      children: [
        { label: 'User Management', icon: faUsersCog, route: '/admin/user-management' },
        { label: 'Request Monitoring', icon: faClipboardCheck, route: '/admin/all-requests' },
        { label: 'Disaster Events', icon: faCloudShowersHeavy, route: '/admin/disaster-management' }
      ]
    },
    { 
      label: 'System', 
      icon: faCogs, 
      isExpanded: false, 
      children: [
        { label: 'Reports', icon: faChartBar, route: '/admin/system-reports' }
      ]
    },

    // --- VOLUNTEER SECTION ---
    {
      label: 'Volunteer', section: 'Volunteer',
      icon: undefined
    },
    { label: 'Dashboard', icon: faHandsHelping, route: '/volunteer/dashboard' },
    { 
      label: 'Tasks', 
      icon: faTasks, 
      isExpanded: false, 
      children: [
        { label: 'Available Requests', icon: faSearchLocation, route: '/volunteer/available-tasks' },
        { label: 'My Assigned Tasks', icon: faClipboardList, route: '/volunteer/my-tasks' }
      ]
    },
    
    // --- VICTIM SECTION ---
    {
      label: 'Victim', section: 'Victim',
      icon: undefined
    },
    { label: 'Dashboard', icon: faUserInjured, route: '/victim/dashboard' },
    { 
      label: 'Requests', 
      icon: faFileSignature, 
      isExpanded: false, 
      children: [
        { label: 'Submit New Request', icon: faPlusCircle, route: '/victim/submit-request' },
        { label: 'My Requests Status', icon: faHistory, route: '/victim/my-requests' },
        { label: 'Provide Feedback', icon: faStar, route: '/victim/feedback' }
      ]
    },

    // --- COMMON SECTION ---
    {
      label: 'Account', section: 'Account',
      icon: undefined
    },
    { label: 'My Profile', icon: faUserCircle, route: '/profile' },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Subscribe to router events to automatically update the active state
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateActiveState(event.urlAfterRedirects);
    });
    // Set the initial active state on component load
    this.updateActiveState(this.router.url);
  }

  get isCollapsed(): boolean {
    return !this.isVisible;
  }

  onToggle(): void {
    this.toggle.emit();
  }

  toggleSubmenu(item: MenuItem): void {
    if (!this.isCollapsed) {
      this.menuItems.forEach(m => {
        if (m !== item && m.children) m.isExpanded = false;
      });
      item.isExpanded = !item.isExpanded;
    }
  }

  /**
   * Navigates to the specified route using Angular's Router.
   * @param route The route to navigate to.
   */
  navigateTo(route: string | undefined): void {
    if (!route) return;
    this.router.navigate([route]);
    if (this.isMobile) {
      this.onToggle();
    }
  }

  /**
   * Updates the active state of menu items based on the current URL.
   * @param currentUrl The current URL from the router.
   */
  private updateActiveState(currentUrl: string): void {
    const matchOptions: IsActiveMatchOptions = {
      paths: 'exact',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored' // Added the required property
    };

    this.menuItems.forEach(item => {
      if (item.route) {
        item.isActive = this.router.isActive(item.route, matchOptions);
      }
      if (item.children) {
        let isParentActive = false;
        item.children.forEach(child => {
          if (child.route) {
            child.isActive = this.router.isActive(child.route, matchOptions);
            if (child.isActive) isParentActive = true;
          }
        });
        item.isActive = isParentActive;
        if (isParentActive) item.isExpanded = true;
      }
    });
  }

  logout(): void {
    console.log('Logging out...');
    // this.router.navigate(['/login']);
  }
}
