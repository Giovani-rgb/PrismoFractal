import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface BannerItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  actionText: string;
}

interface PremiumBenefit {
  icon: string;
  label: string;
  detail: string;
}

@Component({
  selector: 'app-arcade-banner-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bannerCarousel.html',
  styleUrls: ['./bannerCarousel.scss']
})
export class BannerCarousel implements OnInit, OnDestroy {
  private cdr    = inject(ChangeDetectorRef);
  private router = inject(Router);

  @Input() banners: BannerItem[] = [
    {
      id: 'sub_01',
      tag: '[PREMIUM]',
      title: 'PI_NET STUDIO — SEJA PREMIUM',
      description: 'Crie e ouça sem anúncios. Áudio Master sem compressão, MIDI ilimitado e sintetizadores exclusivos.',
      actionText: 'VER BENEFÍCIOS >>'
    },
    {
      id: 'sub_02',
      tag: '[ANÚNCIO]',
      title: 'NOVO MÓDULO DE RITMO DISPONÍVEL',
      description: 'Adicione a nova Drum Machine modular ao seu estúdio virtual e monte sequências de bateria analógica direto no navegador.',
      actionText: 'EXPERIMENTAR NOVO BLOCO'
    },
    {
      id: 'sub_03',
      tag: '[SYSTEM]',
      title: 'ESTAÇÃO DE TRABALHO MODULAR RECOMPILADA',
      description: 'Conecte pedais de efeito virtuais arrastando e soltando cabos digitais. Crie um fluxo de som único para suas playlists.',
      actionText: 'MONTAR SETUP'
    },
    {
      id: 'sub_04',
      tag: '[SECURITY]',
      title: 'PROTEJA SEUS DIREITOS AUTORAIS',
      description: 'Ative a assinatura digital nas suas criações modulares e garanta a autoria das suas tracks antes de exportar para a nuvem.',
      actionText: 'PROTEGER TRACKS'
    }
  ];

  readonly premiumBenefits: PremiumBenefit[] = [
    { icon: '◈', label: 'SEM ANÚNCIOS',         detail: 'Plataforma 100% livre de interrupções comerciais.' },
    { icon: '◈', label: 'ÁUDIO MASTER HD',       detail: 'Exportação WAV 24-bit e FLAC sem compressão de bitrate.' },
    { icon: '◈', label: 'MIDI ILIMITADO',         detail: 'Canais MIDI sem restrição. Conecte controladores externos.' },
    { icon: '◈', label: 'SINTETIZADORES EX.',    detail: 'Biblioteca FM, Wavetable e Granular exclusivos do plano.' },
    { icon: '◈', label: 'PROTEÇÃO AUTORAL',      detail: 'Assinatura criptográfica em cada track — prova de autoria.' },
    { icon: '◈', label: 'DISTRIBUIÇÃO GLOBAL',   detail: 'Envie para Spotify, Apple Music e plataformas parceiras.' },
    { icon: '◈', label: 'PAGAMENTO EM PI',       detail: 'Assine usando Pi Network. Verificado no blockchain Pi.' },
    { icon: '◈', label: 'SUPORTE PRIORITÁRIO',   detail: 'Canal dedicado para membros premium — resposta em 24h.' },
  ];

  showPremiumModal: boolean = false;
  currentIndex: number = 0;
  isSwapping: boolean = false;
  private autoPlayInterval: any;

  ngOnInit() { this.startAutoPlay(); }
  ngOnDestroy() { if (this.autoPlayInterval) clearInterval(this.autoPlayInterval); }

  startAutoPlay() {
    if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
    this.autoPlayInterval = setInterval(() => this.nextSlide(), 5000);
  }

  setSlide(index: number) {
    if (!this.banners || index < 0 || index >= this.banners.length) return;
    this.triggerMotion();
    this.currentIndex = index;
    this.cdr.detectChanges();
    this.startAutoPlay();
  }

  nextSlide() {
    if (!this.banners || this.banners.length === 0) return;
    this.triggerMotion();
    this.currentIndex = (this.currentIndex + 1) % this.banners.length;
    this.cdr.detectChanges();
  }

  onActionClick(banner: BannerItem) {
    const tag = banner.tag?.replace(/[\[\]]/g, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (tag === 'premium') {
      this.showPremiumModal = true;
      clearInterval(this.autoPlayInterval);
    } else {
      this.router.navigate(['/marketplace']);
    }
    this.cdr.detectChanges();
  }

  closePremiumModal() {
    this.showPremiumModal = false;
    this.startAutoPlay();
    this.cdr.detectChanges();
  }

  goToSubscribe() {
    this.showPremiumModal = false;
    this.startAutoPlay();
    this.router.navigate(['/marketplace']);
  }

  private triggerMotion() {
    this.isSwapping = true;
    setTimeout(() => { this.isSwapping = false; this.cdr.detectChanges(); }, 400);
  }

  getAnimationClass(tag: string): string {
    if (!tag) return 'tag-default';
    return `tag-${tag.replace(/[\[\]]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
  }
}
