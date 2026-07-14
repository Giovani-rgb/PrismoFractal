import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-arcade-nav-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navBar.html',
  styleUrls: ['./navBar.scss']
})
export class ArcadeNavBar implements OnInit {
  currentTab: string = 'dashboard';

  constructor(private router: Router) {}

  ngOnInit() {
    // Sincroniza a aba ativa caso a página seja recarregada diretamente por uma URL
    this.updateActiveTab(this.router.url);
    
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateActiveTab(event.urlAfterRedirects);
    });
  }

  setTab(tabName: string) {
    this.currentTab = tabName;
    this.router.navigate([`/${tabName}`]);
  }

  private updateActiveTab(url: string) {
    if (url.includes('explore')) this.currentTab = 'explore';
    else if (url.includes('marketplace')) this.currentTab = 'marketplace';
    else if (url.includes('profile')) this.currentTab = 'profile';
    else this.currentTab = 'dashboard';
  }
}
