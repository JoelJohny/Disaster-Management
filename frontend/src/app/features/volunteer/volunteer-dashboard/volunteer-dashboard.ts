import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSearchLocation } from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-volunteer-dashboard',
  imports: [CommonModule,
    FontAwesomeModule],
  templateUrl: './volunteer-dashboard.html',
  styleUrl: './volunteer-dashboard.scss'
})
export class VolunteerDashboard {
 // Icon definitions
  faSearchLocation = faSearchLocation;

  constructor() { }

}

