import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
constructor(private router: Router) {}

  enter() {
    this.router.navigate(['/']);
  }
}


