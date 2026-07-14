import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ArcadeNavBar } from "../dashboard/components/navBar/navBar";
import { ArcadeHeader } from "../dashboard/components/header/header";
import { OauthContext } from '../../context/oauth.context';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [
    CommonModule,
    ArcadeNavBar,
    ArcadeHeader
  ],
  templateUrl: './explore.html',
  styleUrls: ['./explore.scss']
})
export class Explore implements OnInit {
  private readonly oauthCtx = inject(OauthContext);
  private readonly router   = inject(Router);

  public oauthState = this.oauthCtx.currentState;
  public refillMinutes: number = 0;

  get username(): string {
    const rawData = this.oauthState.data as any;
    return rawData?.username ?? rawData?.name ?? 'Músico';
  }

  get uid(): string {
    const rawData = this.oauthState.data as any;
    return rawData?.uid ?? 'N/A';
  }

  get hasPremium(): boolean {
    const rawData = this.oauthState.data as any;
    return !!(rawData?.premium || rawData?.isPremium || rawData?.roles?.includes('PREMIUM'));
  }

  ngOnInit(): void {
    console.log('%c🎧 [EXPLORE-STREAMING]%c Inicializado com contexto OAuth.', 'background: #00e5ff; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 3px;', '');
    const storedTime = localStorage.getItem('refill_time');
    this.refillMinutes = storedTime ? parseInt(storedTime, 10) : 0;
  }

  goToMarketplace(): void {
    this.router.navigate(['/marketplace']);
  }

  logout(): void {
    console.log('%c🔒 [SESSION]%c Encerrando sessão do terminal...', 'color: #ef4444;', '');
    this.oauthCtx.clear();
    this.router.navigate(['/']);
  }
}
