import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

export interface SidebarItem {
  label: string;
  icon: string;
  route?: string;
  children?: SidebarItem[];
  badge?: string;
  badgeColor?: string;
  isActive?: boolean;
  isExpanded?: boolean;
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule,RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
@Input() isCollapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  menuItems: SidebarItem[] = [
    {
      label: 'Dashboard',
      icon: 'fas fa-tachometer-alt',
      route: '/dashboard'
    },
    {
      label: 'Analytics',
      icon: 'fas fa-chart-bar',
      route: '/analytics',
      badge: '3',
      badgeColor: 'bg-blue-500'
    },
    {
      label: 'Users',
      icon: 'fas fa-users',
      children: [
        { label: 'All Users', icon: 'fas fa-list', route: '/users' },
        { label: 'Add User', icon: 'fas fa-user-plus', route: '/users/add' },
        { label: 'User Roles', icon: 'fas fa-user-cog', route: '/users/roles' }
      ]
    },
    {
      label: 'Products',
      icon: 'fas fa-box',
      children: [
        { label: 'All Products', icon: 'fas fa-boxes', route: '/products' },
        { label: 'Add Product', icon: 'fas fa-plus-circle', route: '/products/add' },
        { label: 'Categories', icon: 'fas fa-tags', route: '/products/categories' },
        { label: 'Inventory', icon: 'fas fa-warehouse', route: '/products/inventory' }
      ]
    },
    {
      label: 'Orders',
      icon: 'fas fa-shopping-cart',
      route: '/orders',
      badge: '12',
      badgeColor: 'bg-red-500'
    },
    {
      label: 'Reports',
      icon: 'fas fa-file-alt',
      children: [
        { label: 'Sales Report', icon: 'fas fa-chart-line', route: '/reports/sales' },
        { label: 'User Report', icon: 'fas fa-user-chart', route: '/reports/users' },
        { label: 'Financial Report', icon: 'fas fa-dollar-sign', route: '/reports/financial' }
      ]
    },
    {
      label: 'Settings',
      icon: 'fas fa-cog',
      children: [
        { label: 'General', icon: 'fas fa-sliders-h', route: '/settings/general' },
        { label: 'Security', icon: 'fas fa-shield-alt', route: '/settings/security' },
        { label: 'Notifications', icon: 'fas fa-bell', route: '/settings/notifications' }
      ]
    },
    {
      label: 'Help & Support',
      icon: 'fas fa-question-circle',
      route: '/support'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.setActiveMenuItem();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  toggleSubmenu(item: SidebarItem): void {
    if (item.children) {
      item.isExpanded = !item.isExpanded;
    }
  }

  navigateTo(route: string): void {
    if (route) {
      this.router.navigate([route]);
      this.setActiveMenuItem();
    }
  }

  private setActiveMenuItem(): void {
    const currentRoute = this.router.url;
    
    this.menuItems.forEach(item => {
      item.isActive = false;
      
      if (item.route === currentRoute) {
        item.isActive = true;
      }
      
      if (item.children) {
        item.children.forEach(child => {
          child.isActive = false;
          if (child.route === currentRoute) {
            child.isActive = true;
            item.isExpanded = true;
          }
        });
      }
    });
  }

  logout(): void {
    // Implement logout logic here
    console.log('Logout clicked');
    this.router.navigate(['/login']);
  }
}
