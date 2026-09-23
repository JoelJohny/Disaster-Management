import { Component, HostListener, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSearch, faBell, faUserPlus, faServer, faSignOutAlt, faBars, faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import { Theme } from '../../services/theme'; // Adjust path if needed



@Component({
  selector: 'app-header',
  imports: [CommonModule,FontAwesomeModule],
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
  faSun = faSun;
  faMoon = faMoon;

  constructor(
    private elementRef: ElementRef,
    public themeService: Theme // Make it public to access in template
  ) { }

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
