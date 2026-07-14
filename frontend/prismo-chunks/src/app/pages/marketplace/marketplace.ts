import { Component, inject, OnInit } from '@angular/core';
import { CommonModule }              from '@angular/common';
import { Router }                    from '@angular/router';

import { ArcadeHeader }    from '../dashboard/components/header/header';
import { ArcadeNavBar }    from '../dashboard/components/navBar/navBar';
import { PiPaymentSheet }  from './pi-payment-sheet/pi-payment-sheet';
import { OauthContext }    from '../../context/oauth.context';
import { PiNetworkService } from '../../services/pi-network.service';

@Component({
  selector:    'app-marketplace',
  standalone:  true,
  imports:     [CommonModule, ArcadeHeader, ArcadeNavBar, PiPaymentSheet],
  templateUrl: './marketplace.html',
  styleUrls:   ['./marketplace.scss']
})
export class Marketplace implements OnInit {
  private readonly oauthCtx    = inject(OauthContext);
  private readonly router      = inject(Router);
  private readonly piService   = inject(PiNetworkService);

  public oauthState              = this.oauthCtx.currentState;
  public isWatchingAd:    boolean = false;
  public currentRefillMinutes: number = 0;

  // Estado do payment sheet
  public showPiSheet:       boolean = false;
  public isPurchasingPremium: boolean = false;
  public premiumPurchaseDone: boolean = false;
  public piPaymentStatus:   string  = '';

  get username(): string {
    const raw = this.oauthState.data as any;
    return raw?.username ?? raw?.name ?? 'Músico';
  }

  get uid(): string {
    const raw = this.oauthState.data as any;
    return raw?.uid ?? 'N/A';
  }

  get isPiReady(): boolean {
    return this.piService.isReady;
  }

  ngOnInit(): void {
    this.updateLocalRefillCount();
    if (localStorage.getItem('prismo_premium_active') === 'true') {
      this.premiumPurchaseDone = true;
    }
  }

  private updateLocalRefillCount(): void {
    const stored = localStorage.getItem('refill_time');
    this.currentRefillMinutes = stored ? parseInt(stored, 10) : 0;
  }

  // ── Abre o sheet modal de pagamento ───────────────────────────────
  openPiSheet(): void {
    if (this.premiumPurchaseDone) return;
    this.piPaymentStatus = '';
    this.showPiSheet = true;
  }

  closePiSheet(): void {
    if (this.isPurchasingPremium) return;
    this.showPiSheet = false;
  }

  // ── Executa o pagamento Pi — disparado pelo sheet ─────────────────
  buyPremiumWithPi(): void {
    if (this.premiumPurchaseDone) return;

    if (!this.isPiReady) {
      this.piPaymentStatus = 'ERRO: Pi SDK indisponível. Abra no Pi Browser.';
      return;
    }

    this.isPurchasingPremium = true;
    this.piPaymentStatus     = 'INICIANDO TRANSAÇÃO NA REDE STELLAR/PI...';

    this.piService.createPayment(
      { amount: 1.0, memo: 'Prismo Premium — Plano Mensal', uid: this.uid },
      {
        onReadyForServerApproval: (paymentId: string) => {
          this.piPaymentStatus = 'AGUARDANDO APROVAÇÃO DO SERVIDOR...';
          // TODO: POST /api/payments/approve { paymentId }
        },
        onReadyForServerCompletion: (paymentId: string, txid: string) => {
          this.piPaymentStatus     = 'TRANSAÇÃO CONFIRMADA // PLANO ATIVO';
          this.premiumPurchaseDone = true;
          this.isPurchasingPremium = false;
          localStorage.setItem('prismo_premium_active', 'true');
          localStorage.setItem('prismo_premium_txid',   txid);
          // TODO: POST /api/payments/complete { txid }
        },
        onCancel: (_paymentId: string) => {
          this.piPaymentStatus     = 'TRANSAÇÃO CANCELADA';
          this.isPurchasingPremium = false;
        },
        onError: (error: any, _payment: any) => {
          this.piPaymentStatus     = `ERRO NA TRANSAÇÃO: ${error?.message ?? 'verifique o Pi Browser.'}`;
          this.isPurchasingPremium = false;
        }
      }
    );
  }

  // ── Outros itens do marketplace ───────────────────────────────────
  buyRefill(minutes: number): void {
    const current = parseInt(localStorage.getItem('refill_time') || '0', 10);
    const updated = current + minutes;
    localStorage.setItem('refill_time', updated.toString());
    this.currentRefillMinutes = updated;
    alert(`Sucesso! +${minutes} minutos adicionados.`);
  }

  watchAd(): void {
    this.isWatchingAd = true;
    setTimeout(() => {
      this.buyRefill(30);
      this.isWatchingAd = false;
    }, 3000);
  }

  logout(): void {
    this.oauthCtx.clear();
    this.router.navigate(['/']);
  }
}
