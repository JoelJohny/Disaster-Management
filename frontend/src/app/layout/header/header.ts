import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSearch, faBell, faUserPlus, faServer, faSignOutAlt ,faBars} from '@fortawesome/free-solid-svg-icons';



@Component({
  selector: 'app-header',
  imports: [CommonModule,FormsModule,FontAwesomeModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {
 @Input() isMobile = false;
  @Output() menuToggle = new EventEmitter<void>();

  isNotificationsOpen = false;
  isUserMenuOpen = false;

  // Icon definitions
  faSearch = faSearch;
  faBell = faBell;
  faUserPlus = faUserPlus;
  faServer = faServer;
  faSignOutAlt = faSignOutAlt;
  faBars = faBars;

  constructor(private elementRef: ElementRef) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isNotificationsOpen = false;
      this.isUserMenuOpen = false;
    }
  }

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  toggleNotifications(): void {
    this.isNotificationsOpen = !this.isNotificationsOpen;
    this.isUserMenuOpen = false;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    this.isNotificationsOpen = false;
  }
}
