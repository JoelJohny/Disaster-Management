import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
@Component({
  selector: 'app-login',
  imports: [CommonModule,
    FontAwesomeModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  // Icon definitions
  faEnvelope = faEnvelope;
  faLock = faLock;
  faGoogle = faGoogle;

  constructor() { }

  // You would add your form submission logic here
  // e.g., using Angular's ReactiveFormsModule.

}