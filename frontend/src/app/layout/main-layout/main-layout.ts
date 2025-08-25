import { RouterModule, RouterOutlet } from '@angular/router';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Subject, filter, map, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet,Header,Footer,Sidebar,RouterModule,CommonModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout  {
 isSidebarVisible = true;
  isMobile = false;
  private wasMobile = false;

  constructor() { }

  /**
   * Listens for window resize events to dynamically adjust the layout.
   */
  @HostListener('window:resize', ['$event'])
  onResize(event?: Event) {
    this.checkScreenSize();
  }

  /**
   * On component initialization, perform an initial screen size check.
   */
  ngOnInit(): void {
    this.wasMobile = window.innerWidth < 768;
    this.checkScreenSize();
  }

  /**
   * Checks the window width and updates layout properties accordingly.
   * This version is more robust and only changes the sidebar visibility
   * when crossing the mobile/desktop breakpoint, preserving the user's
   * collapsed/expanded choice during other resize events.
   */
  private checkScreenSize(): void {
    const isCurrentlyMobile = window.innerWidth < 768;
    
    // Check if we have crossed the breakpoint
    if (isCurrentlyMobile !== this.wasMobile) {
      if (isCurrentlyMobile) {
        this.isSidebarVisible = false; // Hide when switching to mobile
      } else {
        this.isSidebarVisible = true; // Show when switching to desktop
      }
    }
    
    this.isMobile = isCurrentlyMobile;
    this.wasMobile = isCurrentlyMobile;
  }

  /**
   * Toggles the sidebar's visibility. This method is called by both the
   * header's hamburger menu (on mobile) and the sidebar's own toggle button.
   */
  toggleSidebar(): void {
    this.isSidebarVisible = !this.isSidebarVisible;
  }
}
