import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faBullhorn, 
  faHandsHelping, 
  faFolderOpen, 
  faBell, 
  faShieldAlt 
} from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-victim-dashboard',
  imports: [CommonModule,
    FontAwesomeModule],
  templateUrl: './victim-dashboard.html',
  styleUrl: './victim-dashboard.scss'
})
export class VictimDashboard {

 // Icon definitions for the template
  faBullhorn = faBullhorn;
  faHandsHelping = faHandsHelping;
  faFolderOpen = faFolderOpen;
  faBell = faBell;
  faShieldAlt = faShieldAlt;

  constructor() { }

}
