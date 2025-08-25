import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTasks, faUsers } from '@fortawesome/free-solid-svg-icons';

interface AssignedRequest {
  id: string;
  type: string;
  location: string;
  urgency: 'High' | 'Medium' | 'Low';
  status: 'Assigned' | 'In Progress' | 'Pending Confirmation';
  dateAccepted: string;
  peopleCount: number;
  progress: number; // Percentage (0-100)
}

@Component({
  selector: 'app-assigned-tasks',
  imports: [CommonModule,
    FontAwesomeModule,
    NgClass],
  templateUrl: './assigned-tasks.html',
  styleUrl: './assigned-tasks.scss'
})
export class AssignedTasks {
// Icon definitions
  faTasks = faTasks;
  faUsers = faUsers;

  // Mock data for assigned requests
  assignedRequests: AssignedRequest[] = [
    { id: 'REQ-001', type: 'Medical Assistance', location: 'City General Hospital', urgency: 'High', status: 'In Progress', dateAccepted: 'Aug 25, 2025', peopleCount: 1, progress: 50 },
    { id: 'REQ-015', type: 'Food & Water', location: 'Riverside Camp', urgency: 'Medium', status: 'Assigned', dateAccepted: 'Aug 24, 2025', peopleCount: 12, progress: 10 },
    { id: 'REQ-023', type: 'Shelter / Housing', location: 'Southside Community Hall', urgency: 'Medium', status: 'Pending Confirmation', dateAccepted: 'Aug 22, 2025', peopleCount: 4, progress: 90 },
  ];

  constructor() { }

  /**
   * Returns Tailwind CSS classes for a given urgency level.
   */
  getUrgencyColor(urgency: 'High' | 'Medium' | 'Low'): { bgColor: string, textColor: string } {
    switch (urgency) {
      case 'High': return { bgColor: 'bg-red-100', textColor: 'text-red-800' };
      case 'Medium': return { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
      case 'Low': return { bgColor: 'bg-green-100', textColor: 'text-green-800' };
      default: return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }
  }

  /**
   * Returns Tailwind CSS classes for a given status.
   */
  getStatusColor(status: 'Assigned' | 'In Progress' | 'Pending Confirmation'): { bgColor: string, textColor: string } {
    switch (status) {
      case 'Assigned': return { bgColor: 'bg-blue-100', textColor: 'text-blue-800' };
      case 'In Progress': return { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
      case 'Pending Confirmation': return { bgColor: 'bg-purple-100', textColor: 'text-purple-800' };
      default: return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }
  }
}
