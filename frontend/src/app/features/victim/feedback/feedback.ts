import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-feedback',
  imports: [CommonModule,
    FontAwesomeModule,
    NgClass],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss'
})
export class Feedback {


  // Icon definition
  faStar = faStar;

  // Properties for the star rating system
  rating = 0;
  hoverRating = 0;

  constructor() { }

  /**
   * Sets the user's rating when a star is clicked.
   * @param rating The rating value (1-5).
   */
  setRating(rating: number): void {
    this.rating = rating;
  }

}

