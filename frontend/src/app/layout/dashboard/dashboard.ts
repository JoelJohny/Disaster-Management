import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUsers, faClipboardList, faUserShield, faCheckCircle, faArrowUp, 
  faArrowDown, faPlusCircle, faUserCog, faListAlt, faFileExport 
} from '@fortawesome/free-solid-svg-icons';

interface Activity {
  user: string;
  role: 'Volunteer' | 'Victim' | 'Admin';
  action: string;
  time: string;
  link: string;
  avatar: string;
}

// Interface for type safety on recent activity items
interface Activity {
  user: string;
  role: 'Volunteer' | 'Victim' | 'Admin';
  action: string;
  time: string;
  link: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule,FontAwesomeModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {

  // Icon definitions
  faUsers = faUsers;
  faClipboardList = faClipboardList;
  faUserShield = faUserShield;
  faCheckCircle = faCheckCircle;
  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;
  faPlusCircle = faPlusCircle;
  faUserCog = faUserCog;
  faListAlt = faListAlt;
  faFileExport = faFileExport;

  // Data properties for the stat cards
  totalUsers = 0;
  activeRequests = 0;
  volunteersOnline = 0;
  resolvedToday = 0;

  // Data for the recent activity table
  recentActivity: Activity[] = [];

  constructor() { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.totalUsers = 1428;
    this.activeRequests = 73;
    this.volunteersOnline = 42;
    this.resolvedToday = 15;

    this.recentActivity = [
      { user: 'David Lee', role: 'Volunteer', action: 'Accepted a new task', time: '2m ago', link: '#', avatar: 'https://placehold.co/32x32/3498db/ffffff?text=DL' },
      { user: 'Jane Doe', role: 'Victim', action: 'Submitted new help request', time: '15m ago', link: '#', avatar: 'https://placehold.co/32x32/e74c3c/ffffff?text=JD' },
      { user: 'Admin User', role: 'Admin', action: 'Updated system settings', time: '1h ago', link: '#', avatar: 'https://placehold.co/32x32/95a5a6/ffffff?text=A' },
      { user: 'Emily White', role: 'Volunteer', action: 'Completed a task', time: '2h ago', link: '#', avatar: 'https://placehold.co/32x32/2ecc71/ffffff?text=EW' }
    ];
  }
}
