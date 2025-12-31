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
private authenticate() {
    console.log('aqui vai a função de autenticação');
}
  @HostListener('window:keydown.enter')
    onEnterKey() {
      this.authenticate();
    }

    onPressEnterClick() {
      this.authenticate();
    }
}


