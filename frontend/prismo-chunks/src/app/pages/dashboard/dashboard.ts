import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ArcadeHeader } from './components/header/header'; 
import { ArcadeNavBar } from './components/navBar/navBar';
import { OnboardingQuests } from './components/onboardingQuest/onboardingQuest';
import { BannerCarousel } from './components/bannerCarroussel/bannerCarousel';
import { OauthContext } from '../../context/oauth.context';

interface ArcadeQuests {
  accountActivated: boolean;
  emailProvided: boolean;
  profileConfigured: boolean;
  donationMade: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    ArcadeHeader,
    ArcadeNavBar,
    OnboardingQuests,
    BannerCarousel
  ], 
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private readonly oauthCtx = inject(OauthContext);
  private readonly router   = inject(Router);

  // Expõe o estado do OAuth síncronamente do BehaviorSubject
  public oauthState = this.oauthCtx.currentState;

  // ─── Estado das Quests Obrigatórias (Onboarding) ───────
  public quests: ArcadeQuests = {
    accountActivated: true,   
    emailProvided: false,      
    profileConfigured: false, 
    donationMade: false       
  };

  /**
   * Avalia dinamicamente se a Section For You deve continuar bloqueada
   */
  get hasPendingQuests(): boolean {
    return Object.values(this.quests).some(status => !status);
  }

  // ─── Getters de Usuário Existentes ─────────────────────
  get username(): string {
    const rawData = this.oauthState.data as any;
    return rawData?.username ?? rawData?.name ?? 'Músico';
  }

  get uid(): string {
    const rawData = this.oauthState.data as any;
    return rawData?.uid ?? 'N/A';
  }

  // ─── Ciclo de Vida ─────────────────────────────────────
  ngOnInit(): void {
    console.log('%c🎵 [AUDIO-DASHBOARD]%c Inicializado no Angular 21.', 'background: #7c3aed; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 3px;', '');
    
    console.log(
      '%c⚙️ [PRISMO DEBUG]%c Estrutura real de `oauthState.data` recebida no Dashboard:', 
      'background: #2563eb; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 3px;', 
      ''
    );
    console.log(this.oauthState.data);
  }

  // ─── Lógica Interativa do Checklist de Quests ──────────
  /**
   * Captura o evento disparado pelo OnboardingQuests para guiar o usuário
   */
  handleQuestRedirection(action: string): void {
    console.log(`%c🎯 [QUEST ACTION]%c Diretriz recebida: ${action}`, 'color: #e29b00; font-weight: bold;', '');
    switch (action) {
      case 'activate':
        break;
      case 'email':
        this.quests = { ...this.quests, emailProvided: true };
        break;
      case 'profile':
        this.router.navigate(['/profile/edit']);
        break;
      case 'donate':
        break;
    }
  }

  handleEmailSubmitted(email: string): void {
    console.log('%c📧 [ONBOARDING]%c E-mail de usuário registrado.', 'color: #00e5ff;', '');
    this.quests = { ...this.quests, emailProvided: true };
  }

  // ─── Navegação e Esteiras Operacionais ─────────────────
  /**
   * Redireciona para a esteira ou módulo de geração/composição de áudio
   */
  navigateToCreator(): void {
    if (this.hasPendingQuests) {
      console.warn('🛑 [ACCESSO NEGADO] Conclua as quests obrigatórias primeiro.');
      return;
    }
    console.log('%c🎛️ [CREATOR]%c Iniciando estúdio de criação musical...', 'color: #8b5cf6;', '');
    this.router.navigate(['/dashboard/studio']);
  }

  /**
   * Redireciona para a plataforma de streaming/player
   */
  navigateToStreaming(): void {
    if (this.hasPendingQuests) {
      console.warn('🛑 [ACCESSO NEGADO] Conclua as quests obrigatórias primeiro.');
      return;
    }
    console.log('%c🎧 [STREAMING]%c Abrindo player de áudio...', 'color: #3b82f6;', '');
    this.router.navigate(['/dashboard/player']);
  }

  logout(): void {
    console.log('%c🔒 [SESSION]%c Encerrando sessão do terminal...', 'color: #ef4444;', '');
    this.oauthCtx.clear();
    this.router.navigate(['/']);
  }
}

