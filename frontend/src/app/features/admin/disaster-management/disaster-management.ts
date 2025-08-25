import { Component, OnInit } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faPlusCircle, 
  faPencilAlt, 
  faEye 
} from '@fortawesome/free-solid-svg-icons';

interface DisasterEvent {
  id: number;
  name: string;
  location: string;
  status: 'Active' | 'Upcoming' | 'Past';
  startDate: string;
  endDate?: string;
}

@Component({
  selector: 'app-disaster-management',
  imports: [CommonModule,
    FontAwesomeModule,
    NgClass],
  templateUrl: './disaster-management.html',
  styleUrl: './disaster-management.scss'
})
export class DisasterManagement implements OnInit {

  // Icon definitions
  faPlusCircle = faPlusCircle;
  faPencilAlt = faPencilAlt;
  faEye = faEye;

  // Mock data for the events table
  disasterEvents: DisasterEvent[] = [];

  constructor() { }

  ngOnInit(): void {
    this.disasterEvents = this.getMockEvents();
  }

  /**
   * Returns Tailwind CSS classes for a given event status.
   */
  getStatusColor(status: 'Active' | 'Upcoming' | 'Past'): { bgColor: string, textColor: string } {
    switch (status) {
      case 'Active': return { bgColor: 'bg-red-100', textColor: 'text-red-800' };
      case 'Upcoming': return { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
      case 'Past': return { bgColor: 'bg-gray-200', textColor: 'text-gray-800' };
      default: return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }
  }

  /**
   * Generates a list of mock disaster events.
   */
  private getMockEvents(): DisasterEvent[] {
    return [
      { id: 1, name: 'Kerala Floods 2025', location: 'Kerala, India', status: 'Active', startDate: 'Aug 15, 2025' },
      { id: 2, name: 'Cyclone Remal Response', location: 'West Bengal, India', status: 'Past', startDate: 'May 26, 2024', endDate: 'Jun 10, 2024' },
      { id: 3, name: 'Pre-Monsoon Preparedness', location: 'Mumbai, India', status: 'Upcoming', startDate: 'Sep 01, 2025', endDate: 'Sep 05, 2025' },
      { id: 4, name: 'Uttarakhand Landslide Relief', location: 'Uttarakhand, India', status: 'Past', startDate: 'Jul 20, 2024', endDate: 'Aug 05, 2024' },
    ];
  }
}
