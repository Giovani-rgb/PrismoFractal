import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ArcadeHeader } from "../dashboard/components/header/header";
import { ArcadeNavBar } from "../dashboard/components/navBar/navBar";
import { OauthContext } from '../../context/oauth.context';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ArcadeHeader,
    ArcadeNavBar
  ],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class Profile implements OnInit {
  private readonly oauthCtx = inject(OauthContext);
  private readonly router   = inject(Router);

  public oauthState = this.oauthCtx.currentState;
  public currentRefill: number = 0;

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

  get avatar(): string {
    const rawData = this.oauthState.data as any;
    return rawData?.avatar ?? rawData?.picture ?? '🕹️';
  }

  ngOnInit(): void {
    const storedTime = localStorage.getItem('refill_time');
    this.currentRefill = storedTime ? parseInt(storedTime, 10) : 0;
  }

  logout(): void {
    console.log('%c🔒 [SESSION]%c Encerrando sessão do terminal...', 'color: #ef4444;', '');
    this.oauthCtx.clear();
    this.router.navigate(['/']);
  }
}
