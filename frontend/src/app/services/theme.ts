import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Theme {
  
private renderer: Renderer2;
  private isDarkMode = false;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initializeTheme();
  }

  /**
   * Checks localStorage and system preference to set the initial theme.
   */
  private initializeTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      // Fallback to system preference if no theme is saved
      this.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.updateBodyClass();
  }

  /**
   * Toggles the theme between dark and light mode.
   */
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    this.updateBodyClass();
  }

  /**
   * Returns the current state of the dark mode.
   */
  isDark(): boolean {
    console.log(this.isDarkMode);
    
    return this.isDarkMode;
  }

  /**
   * Adds or removes the 'dark' class from the document body.
   */
  private updateBodyClass(): void {
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark');
    } else {
      this.renderer.removeClass(document.body, 'dark');
    }
  }
}

