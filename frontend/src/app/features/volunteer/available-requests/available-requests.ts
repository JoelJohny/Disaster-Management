import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faHeartbeat, faUtensils, faHome, faTruck, faList, faMapMarkedAlt,
  faMapMarkerAlt, faUsers
} from '@fortawesome/free-solid-svg-icons';

interface AvailableRequest {
  id: string;
  type: string;
  urgency: 'High' | 'Medium' | 'Low';
  location: string;
  distance: number;
  peopleCount: number;
  timeAgo: string;
  icon: any;
  iconBgColor: string;
}
@Component({
  selector: 'app-available-requests',
  imports: [CommonModule,
    FontAwesomeModule,
    NgClass],
  templateUrl: './available-requests.html',
  styleUrl: './available-requests.scss'
})
export class AvailableRequests {

 // Icon definitions
  faList = faList;
  faMapMarkedAlt = faMapMarkedAlt;
  faMapMarkerAlt = faMapMarkerAlt;
  faUsers = faUsers;

  // Mock data for available requests
  availableRequests: AvailableRequest[] = [
    { id: 'REQ-001', type: 'Medical Assistance', urgency: 'High', location: 'City General Hospital', distance: 2.5, peopleCount: 1, timeAgo: '15m ago', icon: faHeartbeat, iconBgColor: 'bg-red-500' },
    { id: 'REQ-007', type: 'Food & Water', urgency: 'Medium', location: 'Downtown Community Shelter', distance: 5.1, peopleCount: 12, timeAgo: '45m ago', icon: faUtensils, iconBgColor: 'bg-yellow-500' },
    { id: 'REQ-009', type: 'Shelter / Housing', urgency: 'Medium', location: 'Northside Apartments', distance: 8.3, peopleCount: 4, timeAgo: '2h ago', icon: faHome, iconBgColor: 'bg-blue-500' },
    { id: 'REQ-010', type: 'Rescue / Evacuation', urgency: 'High', location: 'Riverside Park', distance: 12.0, peopleCount: 3, timeAgo: '3h ago', icon: faTruck, iconBgColor: 'bg-red-500' },
    { id: 'REQ-011', type: 'Food & Water', urgency: 'Low', location: 'West End Library', distance: 6.7, peopleCount: 8, timeAgo: '5h ago', icon: faUtensils, iconBgColor: 'bg-green-500' },
  ];

  constructor() { }

  /**
   * Returns the appropriate Tailwind CSS classes for a given urgency level.
   * @param urgency The urgency of the request.
   * @returns A string of CSS classes for the urgency badge.
   */
  getUrgencyColor(urgency: 'High' | 'Medium' | 'Low'): string {
    switch (urgency) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}

