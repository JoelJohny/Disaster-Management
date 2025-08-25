import { Component, OnInit } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

interface HelpRequest {
  id: string;
  submittedBy: string;
  type: string;
  urgency: 'High' | 'Medium' | 'Low';
  status: 'Submitted' | 'In Progress' | 'Completed' | 'Cancelled';
  assignedTo?: string; // Optional: name of the assigned volunteer
}

@Component({
  selector: 'app-all-requests',
  imports: [CommonModule,
    FontAwesomeModule,
    NgClass],
  templateUrl: './all-requests.html',
  styleUrl: './all-requests.scss'
})
export class AllRequests implements OnInit {

  // Mock data for the requests table
  requests: HelpRequest[] = [];

  constructor() { }

  ngOnInit(): void {
    this.requests = this.getMockRequests();
  }

  /**
   * Returns Tailwind CSS text color classes for a given urgency level.
   */
  getUrgencyColor(urgency: 'High' | 'Medium' | 'Low'): { textColor: string } {
    switch (urgency) {
      case 'High': return { textColor: 'text-red-600' };
      case 'Medium': return { textColor: 'text-yellow-600' };
      case 'Low': return { textColor: 'text-green-600' };
      default: return { textColor: 'text-gray-600' };
    }
  }

  /**
   * Returns Tailwind CSS background and text color classes for a given status.
   */
  getStatusColor(status: 'Submitted' | 'In Progress' | 'Completed' | 'Cancelled'): { bgColor: string, textColor: string } {
    switch (status) {
      case 'Submitted': return { bgColor: 'bg-blue-100', textColor: 'text-blue-800' };
      case 'In Progress': return { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
      case 'Completed': return { bgColor: 'bg-green-100', textColor: 'text-green-800' };
      case 'Cancelled': return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
      default: return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }
  }

  /**
   * Generates a list of mock requests.
   */
  private getMockRequests(): HelpRequest[] {
    return [
      { id: 'REQ-001', submittedBy: 'Jane Doe', type: 'Medical Assistance', urgency: 'High', status: 'In Progress', assignedTo: 'David Lee' },
      { id: 'REQ-002', submittedBy: 'John Smith', type: 'Food & Water', urgency: 'Medium', status: 'Completed', assignedTo: 'Emily White' },
      { id: 'REQ-003', submittedBy: 'Maria Garcia', type: 'Shelter / Housing', urgency: 'Medium', status: 'Submitted' },
      { id: 'REQ-004', submittedBy: 'Chen Wei', type: 'Rescue / Evacuation', urgency: 'High', status: 'Cancelled' },
      { id: 'REQ-005', submittedBy: 'Fatima Al-Sayed', type: 'Medical Assistance', urgency: 'High', status: 'Submitted' },
    ];
  }
}
