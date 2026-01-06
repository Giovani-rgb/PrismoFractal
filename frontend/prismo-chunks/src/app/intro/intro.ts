import { Component, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GameMenu } from '../game-menu/game-menu';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-intro',
  imports: [GameMenu],
  templateUrl: './intro.html',
  styleUrl: './intro.scss',
})
export class Intro {
  router = inject(Router);
  sessionService = inject(SessionService);

  private authenticate() {
    
    this.router.navigate(['/dashboard']);
  }

  @HostListener('window:keydown.enter')
  onEnterKey() {
    this.authenticate();
  }

  onPressEnterClick() {
    this.authenticate();
  }
}


