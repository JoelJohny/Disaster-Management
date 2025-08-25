import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faUser, faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-registration',
  imports: [CommonModule,
    FontAwesomeModule],
  templateUrl: './registration.html',
  styleUrl: './registration.scss'
})
export class Registration {

// Icon definitions
  faUser = faUser;
  faEnvelope = faEnvelope;
  faLock = faLock;

  constructor() { }

  // You would add your form submission logic here,
  // including validation for matching passwords.
  
}
