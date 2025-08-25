import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faEnvelope, 
  faPhone, 
  faPencilAlt, 
  faTimes 
} from '@fortawesome/free-solid-svg-icons';

interface User {
  name: string;
  email: string;
  phone: string;
  role: 'Victim' | 'Volunteer' | 'Admin';
  avatar: string;
}

@Component({
  selector: 'app-user-profile',
  imports: [CommonModule,
    FontAwesomeModule
  ],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss'
})
export class UserProfile implements OnInit {

  // Icon definitions
  faEnvelope = faEnvelope;
  faPhone = faPhone;
  faPencilAlt = faPencilAlt;
  faTimes = faTimes;

  // State for the component
  isEditing = false;
  user!: User; // Using definite assignment assertion

  constructor() { }

  ngOnInit(): void {
    // In a real app, you would fetch the logged-in user's data from a service
    this.user = this.getMockUser();
  }

  /**
   * Toggles the edit mode for the profile information form.
   */
  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
  }

  /**
   * Generates mock user data.
   */
  private getMockUser(): User {
    // This data would be dynamic based on the logged-in user
    return {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '(555) 123-4567',
      role: 'Victim',
      avatar: 'https://placehold.co/96x96/e74c3c/ffffff?text=JD'
    };
  }
}
