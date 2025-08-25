import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faHeartbeat, faUtensils, faHome, faTruck, 
  faQuestionCircle, faFolderOpen 
} from '@fortawesome/free-solid-svg-icons';

interface HelpRequest {
  id: string;
  type: string;
  date: string;
  status: 'Submitted' | 'In Progress' | 'Completed' | 'Cancelled';
  icon: any;
  iconBgColor: string;
}
@Component({
  selector: 'app-request-status',
  imports: [CommonModule,
    FontAwesomeModule,
    NgClass],
  templateUrl: './request-status.html',
  styleUrl: './request-status.scss'
})
export class RequestStatus {

  // Icon definitions
  faFolderOpen = faFolderOpen;

  // State for filtering and pagination
  currentFilter: string = 'All';
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  
  // Arrays to manage request data
  allRequests: HelpRequest[] = []; // Holds all requests from the source
  filteredRequests: HelpRequest[] = []; // Holds requests after filtering
  paginatedRequests: HelpRequest[] = []; // Holds requests for the current page

  constructor() { }

  ngOnInit(): void {
    // In a real app, you would fetch this data from an API
    this.allRequests = this.getMockRequests();
    this.updateRequestsView();
  }

  /**
   * Updates the filtered and paginated request lists based on the current state.
   */
  updateRequestsView(): void {
    // 1. Apply Filter
    if (this.currentFilter === 'All') {
      this.filteredRequests = [...this.allRequests];
    } else {
      this.filteredRequests = this.allRequests.filter(req => req.status === this.currentFilter);
    }

    // 2. Apply Pagination
    this.totalPages = Math.ceil(this.filteredRequests.length / this.itemsPerPage);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedRequests = this.filteredRequests.slice(startIndex, endIndex);
  }

  /**
   * Sets the current filter and resets the view to the first page.
   * @param status The status to filter by.
   */
  setFilter(status: string): void {
    this.currentFilter = status;
    this.currentPage = 1;
    this.updateRequestsView();
  }

  /**
   * Navigates to the next page of requests.
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateRequestsView();
    }
  }

  /**
   * Navigates to the previous page of requests.
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateRequestsView();
    }
  }

  /**
   * Returns the appropriate Tailwind CSS classes for a given request status.
   */
  getStatusColor(status: 'Submitted' | 'In Progress' | 'Completed' | 'Cancelled'): string {
    switch (status) {
      case 'Submitted': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Generates a larger set of mock data to demonstrate pagination.
   */
  getMockRequests(): HelpRequest[] {
    return [
      { id: 'REQ-001', type: 'Medical Assistance', date: 'Aug 25, 2025', status: 'In Progress', icon: faHeartbeat, iconBgColor: 'bg-red-500' },
      { id: 'REQ-002', type: 'Food & Water', date: 'Aug 24, 2025', status: 'Completed', icon: faUtensils, iconBgColor: 'bg-green-500' },
      { id: 'REQ-003', type: 'Shelter / Housing', date: 'Aug 22, 2025', status: 'Submitted', icon: faHome, iconBgColor: 'bg-blue-500' },
      { id: 'REQ-004', type: 'Rescue / Evacuation', date: 'Aug 21, 2025', status: 'Cancelled', icon: faTruck, iconBgColor: 'bg-gray-500' },
      { id: 'REQ-005', type: 'Medical Assistance', date: 'Aug 20, 2025', status: 'Completed', icon: faHeartbeat, iconBgColor: 'bg-green-500' },
      { id: 'REQ-006', type: 'Other', date: 'Aug 19, 2025', status: 'Submitted', icon: faQuestionCircle, iconBgColor: 'bg-purple-500' },
      { id: 'REQ-007', type: 'Food & Water', date: 'Aug 18, 2025', status: 'In Progress', icon: faUtensils, iconBgColor: 'bg-yellow-500' },
      { id: 'REQ-008', type: 'Shelter / Housing', date: 'Aug 17, 2025', status: 'Completed', icon: faHome, iconBgColor: 'bg-green-500' },
      { id: 'REQ-009', type: 'Medical Assistance', date: 'Aug 15, 2025', status: 'Submitted', icon: faHeartbeat, iconBgColor: 'bg-blue-500' },
      { id: 'REQ-010', type: 'Rescue / Evacuation', date: 'Aug 14, 2025', status: 'In Progress', icon: faTruck, iconBgColor: 'bg-yellow-500' },
    ];
  }
}
