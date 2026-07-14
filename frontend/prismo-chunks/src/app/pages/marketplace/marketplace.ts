import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ArcadeHeader } from "../dashboard/components/header/header";
import { ArcadeNavBar } from "../dashboard/components/navBar/navBar";
import { OauthContext } from '../../context/oauth.context';

declare const window: any;

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    ArcadeHeader,
    ArcadeNavBar
  ],
  templateUrl: './marketplace.html',
  styleUrls: ['./marketplace.scss']
})
export class Marketplace implements OnInit {
  private readonly oauthCtx = inject(OauthContext);
  private readonly router   = inject(Router);

  public oauthState = this.oauthCtx.currentState;
  public isWatchingAd:       boolean = false;
  public currentRefillMinutes: number = 0;

  // Estado do pagamento Pi
  public isPurchasingPremium: boolean = false;
  public premiumPurchaseDone: boolean = false;
  public piPaymentStatus:     string  = '';

  get username(): string {
    const rawData = this.oauthState.data as any;
    return rawData?.username ?? rawData?.name ?? 'Músico';
  }

  get uid(): string {
    const rawData = this.oauthState.data as any;
    return rawData?.uid ?? 'N/A';
  }

  get isPiReady(): boolean {
    return !!(window.__piSdkReady && typeof window.Pi?.createPayment === 'function');
  }

  ngOnInit(): void {
    this.updateLocalRefillCount();
    const stored = localStorage.getItem('prismo_premium_active');
    if (stored === 'true') this.premiumPurchaseDone = true;
  }

  private updateLocalRefillCount(): void {
    const storedTime = localStorage.getItem('refill_time');
    this.currentRefillMinutes = storedTime ? parseInt(storedTime, 10) : 0;
  }

  buyRefill(minutes: number): void {
    const currentTime = parseInt(localStorage.getItem('refill_time') || '0', 10);
    const newTime = currentTime + minutes;
    localStorage.setItem('refill_time', newTime.toString());
    this.currentRefillMinutes = newTime;
    alert(`Sucesso! +${minutes} minutos adicionados.`);
  }

  watchAd(): void {
    this.isWatchingAd = true;
    setTimeout(() => {
      this.buyRefill(30);
      this.isWatchingAd = false;
    }, 3000);
  }

  // ─────────────────────────────────────────────────────────────────────
  // PAGAMENTO PI NETWORK — Assinar Plano Premium
  // Requer usuário autenticado na Pi Network (window.__piSdkReady = true)
  // ─────────────────────────────────────────────────────────────────────
  buyPremiumWithPi(): void {
    if (this.premiumPurchaseDone) {
      this.piPaymentStatus = 'PLANO JÁ ATIVO // Nenhuma cobrança adicional.';
      return;
    }

    if (!this.isPiReady) {
      this.piPaymentStatus = 'ERRO: Pi SDK indisponível. Abra no Pi Browser para pagar com Pi.';
      return;
    }

    this.isPurchasingPremium = true;
    this.piPaymentStatus     = 'INICIANDO TRANSAÇÃO PI...';

    const paymentData = {
      amount: 1.0,
      memo:   'Prismo Premium — Plano Mensal',
      metadata: {
        plan:    'premium_monthly',
        uid:     this.uid,
        version: '1.0'
      }
    };

    const callbacks = {
      onReadyForServerApproval: (paymentId: string) => {
        console.log('[Pi Payment] Aguardando aprovação do servidor. paymentId:', paymentId);
        this.piPaymentStatus = 'AGUARDANDO APROVAÇÃO DO SERVIDOR...';
        // TODO: Chamar backend /api/payments/approve com paymentId
      },
      onReadyForServerCompletion: (paymentId: string, txid: string) => {
        console.log('[Pi Payment] Transação concluída. paymentId:', paymentId, '| txid:', txid);
        this.piPaymentStatus     = 'TRANSAÇÃO CONFIRMADA // PLANO PREMIUM ATIVO';
        this.premiumPurchaseDone = true;
        this.isPurchasingPremium = false;
        localStorage.setItem('prismo_premium_active', 'true');
        localStorage.setItem('prismo_premium_txid',   txid);
        // TODO: Chamar backend /api/payments/complete com txid
      },
      onCancel: (paymentId: string) => {
        console.warn('[Pi Payment] Transação cancelada pelo usuário. paymentId:', paymentId);
        this.piPaymentStatus     = 'TRANSAÇÃO CANCELADA';
        this.isPurchasingPremium = false;
      },
      onError: (error: any, payment: any) => {
        console.error('[Pi Payment] Erro:', error, payment);
        this.piPaymentStatus     = `ERRO NA TRANSAÇÃO: ${error?.message ?? 'verifique o Pi Browser.'}`;
        this.isPurchasingPremium = false;
      }
    };

    try {
      window.Pi.createPayment(paymentData, callbacks);
    } catch (e: any) {
      this.piPaymentStatus     = `ERRO: ${e?.message ?? 'Pi SDK não disponível.'}`;
      this.isPurchasingPremium = false;
    }
  }

  logout(): void {
    console.log('%c🔒 [SESSION]%c Encerrando sessão do terminal...', 'color: #ef4444;', '');
    this.oauthCtx.clear();
    this.router.navigate(['/']);
  }
}
