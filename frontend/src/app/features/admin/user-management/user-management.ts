import { Component, OnInit } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faSearch, 
  faUserPlus, 
  faPencilAlt, 
  faTrashAlt 
} from '@fortawesome/free-solid-svg-icons';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Volunteer' | 'Victim';
  status: 'Active' | 'Inactive';
  dateJoined: string;
  avatar: string;
}
@Component({
  selector: 'app-user-management',
  imports: [CommonModule,
    FontAwesomeModule,
    NgClass],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss'
})
export class UserManagement {
 // Icon definitions
  faSearch = faSearch;
  faUserPlus = faUserPlus;
  faPencilAlt = faPencilAlt;
  faTrashAlt = faTrashAlt;

  // Mock data for the users table
  users: User[] = [];

  constructor() { }

  ngOnInit(): void {
    this.users = this.getMockUsers();
  }

  /**
   * Returns Tailwind CSS classes for a given user role.
   */
  getRoleColor(role: 'Admin' | 'Volunteer' | 'Victim'): { bgColor: string, textColor: string } {
    switch (role) {
      case 'Admin': return { bgColor: 'bg-gray-200', textColor: 'text-gray-800' };
      case 'Volunteer': return { bgColor: 'bg-green-100', textColor: 'text-green-800' };
      case 'Victim': return { bgColor: 'bg-red-100', textColor: 'text-red-800' };
      default: return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }
  }

  /**
   * Generates a list of mock users.
   */
  private getMockUsers(): User[] {
    return [
      { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'Admin', status: 'Active', dateJoined: 'Jan 15, 2024', avatar: 'https://placehold.co/40x40/95a5a6/ffffff?text=A' },
      { id: 2, name: 'David Lee', email: 'david.lee@example.com', role: 'Volunteer', status: 'Active', dateJoined: 'Mar 02, 2024', avatar: 'https://placehold.co/40x40/3498db/ffffff?text=DL' },
      { id: 3, name: 'Jane Doe', email: 'jane.doe@example.com', role: 'Victim', status: 'Active', dateJoined: 'Aug 10, 2025', avatar: 'https://placehold.co/40x40/e74c3c/ffffff?text=JD' },
      { id: 4, name: 'Emily White', email: 'emily.white@example.com', role: 'Volunteer', status: 'Inactive', dateJoined: 'Feb 20, 2024', avatar: 'https://placehold.co/40x40/2ecc71/ffffff?text=EW' },
    ];
  }
}
