import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUsersCog, 
  faClipboardList, 
  faChartLine, 
  faFileAlt 
} from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-system-reports',
  imports: [CommonModule,
    FontAwesomeModule],
  templateUrl: './system-reports.html',
  styleUrl: './system-reports.scss'
})
export class SystemReports {

 // Icon definitions
  faUsersCog = faUsersCog;
  faClipboardList = faClipboardList;
  faChartLine = faChartLine;
  faFileAlt = faFileAlt;

  constructor() { }

}
