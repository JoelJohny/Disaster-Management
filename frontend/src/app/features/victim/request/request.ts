import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faMapMarkerAlt, 
  faUsers, 
  faPhone,
  faClipboardList,
  faCommentDots
} from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-request',
  imports: [CommonModule,
    FontAwesomeModule],
  templateUrl: './request.html',
  styleUrl: './request.scss'
})
export class Request {
 // Property to manage the current step of the form
  currentStep = 1;

  // Icon definitions for the template
  faMapMarkerAlt = faMapMarkerAlt;
  faUsers = faUsers;
  faPhone = faPhone;
  faClipboardList = faClipboardList;
  faCommentDots = faCommentDots;

  constructor() { }

  /**
   * Navigates to the next step in the form.
   */
  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  /**
   * Navigates to the previous step in the form.
   */
  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // You would add your form submission logic here,
  // likely using Angular's ReactiveFormsModule for robust validation.

}
