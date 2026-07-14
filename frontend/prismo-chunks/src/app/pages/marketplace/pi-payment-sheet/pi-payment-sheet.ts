import {
  Component, Input, Output, EventEmitter,
  HostListener, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PiPlanBenefit {
  icon: string;
  label: string;
}

@Component({
  selector: 'app-pi-payment-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pi-payment-sheet.html',
  styleUrls: ['./pi-payment-sheet.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PiPaymentSheet {
  @Input() visible       = false;
  @Input() isPurchasing  = false;
  @Input() isDone        = false;
  @Input() isPiReady     = false;
  @Input() paymentStatus = '';

  @Output() onClose          = new EventEmitter<void>();
  @Output() onConfirmPayment = new EventEmitter<void>();

  readonly planName    = 'PRISMO PREMIUM';
  readonly planPrice   = '1 π / MÊS';
  readonly planDesc    = 'Acesso completo ao estúdio profissional via Pi Network';

  readonly benefits: PiPlanBenefit[] = [
    { icon: '◈', label: 'Sem anúncios — experiência limpa' },
    { icon: '◈', label: 'Áudio Master HD (96kHz / 32-bit)' },
    { icon: '◈', label: 'MIDI ilimitado + exportação WAV/FLAC' },
    { icon: '◈', label: 'Distribuição global (Spotify, Apple Music, +)' },
    { icon: '◈', label: 'Assinatura digital criptográfica em blockchain' },
    { icon: '◈', label: 'Colaboração em tempo real (até 4 artistas)' },
    { icon: '◈', label: 'Histórico ilimitado de versões de composição' },
    { icon: '◈', label: 'Suporte prioritário e acesso antecipado' },
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible && !this.isPurchasing) this.close();
  }

  close(): void {
    if (this.isPurchasing) return;
    this.onClose.emit();
  }

  confirm(): void {
    if (this.isPurchasing || this.isDone) return;
    this.onConfirmPayment.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('sheet-backdrop')) {
      this.close();
    }
  }
}
