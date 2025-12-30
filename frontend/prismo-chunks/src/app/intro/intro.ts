import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { GameMenu } from '../game-menu/game-menu';

@Component({
  selector: 'app-intro',
  imports: [GameMenu],
  templateUrl: './intro.html',
  styleUrl: './intro.scss',
})
export class Intro {
  constructor(private router: Router) {}

  @HostListener('window:keydown.enter')
  enterGame() {
    this.router.navigate(['/world']);
  }
}
