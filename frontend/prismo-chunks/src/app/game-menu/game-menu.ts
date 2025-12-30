import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';


@Component({
  selector: 'app-game-menu',
  imports: [CommonModule],
  templateUrl: './game-menu.html',
  styleUrl: './game-menu.scss',
})
export class GameMenu {
  items = [
    { label: 'START', action: () => this.go('/world') },
    { label: 'SONGS', action: () => this.go('/songs') },
    { label: 'SETTINGS', action: () => console.log('settings') },
    { label: 'EXIT', action: () => console.log('exit') }
  ];

  selectedIndex = 0;

  constructor(private router: Router) {}

  @HostListener('window:keydown.arrowdown')
  down() {
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
  }

  @HostListener('window:keydown.arrowup')
  up() {
    this.selectedIndex =
      (this.selectedIndex - 1 + this.items.length) % this.items.length;
  }

  @HostListener('window:keydown.enter')
  select(index?: number) {
    if (index !== undefined) {
      this.selectedIndex = index;
    }
    this.items[this.selectedIndex].action();
  }


  private go(path: string) {
    this.router.navigate([path]);
  }
}

