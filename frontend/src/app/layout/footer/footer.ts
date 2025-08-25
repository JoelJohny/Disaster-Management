import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [CommonModule,RouterModule,FormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer {
@Input() isSidebarCollapsed = false;
currentYear = new Date().getFullYear();
  appVersion = '2.1.4';
  lastUpdateTime = new Date();
  
  // System stats
  systemStats = {
    upTime: '99.9%',
    activeUsers: 1247,
    totalOrders: 15632,
    revenue: 125340
  };

  // Quick links
  quickLinks = [
    { label: 'Documentation', url: '/docs', icon: 'fas fa-book' },
    { label: 'API Reference', url: '/api', icon: 'fas fa-code' },
    { label: 'Support', url: '/support', icon: 'fas fa-life-ring' },
    { label: 'Privacy Policy', url: '/privacy', icon: 'fas fa-shield-alt' }
  ];

  // Social links
  socialLinks = [
    { name: 'Twitter', url: 'https://twitter.com', icon: 'fab fa-twitter' },
    { name: 'LinkedIn', url: 'https://linkedin.com', icon: 'fab fa-linkedin' },
    { name: 'GitHub', url: 'https://github.com', icon: 'fab fa-github' }
  ];

  constructor() {}

  ngOnInit(): void {
    // Update system stats periodically
    setInterval(() => {
      this.updateSystemStats();
    }, 30000); // Update every 30 seconds
  }

  private updateSystemStats(): void {
    // Simulate real-time stats updates
    this.systemStats.activeUsers += Math.floor(Math.random() * 10) - 5;
    this.systemStats.totalOrders += Math.floor(Math.random() * 3);
    this.systemStats.revenue += Math.floor(Math.random() * 1000);
    this.lastUpdateTime = new Date();
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  getFormattedRevenue(): string {
    return '$' + this.formatNumber(this.systemStats.revenue);
  }
}
