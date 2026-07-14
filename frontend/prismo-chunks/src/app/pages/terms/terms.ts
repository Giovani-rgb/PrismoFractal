import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  template: `
    <div class="arcade-viewport">
      <div class="crt-screen info-theme">
        <div class="scanlines"></div>

        <div class="screen-header">TERMS_SYS // v1.0 — PRISMO PLATFORM</div>

        <div class="screen-body code-scroll">
          <h1>TERMOS DE USO</h1>

          <p class="section-label">[01] ACEITAÇÃO</p>
          <p>Ao acessar ou utilizar a plataforma Prismo, você concorda integralmente com estes Termos. Caso discorde de qualquer cláusula, interrompa o uso imediatamente.</p>

          <p class="section-label">[02] DESCRIÇÃO DO SERVIÇO</p>
          <p>O Prismo é uma plataforma de composição musical modular baseada em navegador. Oferece ferramentas de criação, gerenciamento de tracks, streaming interno e integração com o ecossistema Pi Network para pagamentos e autenticação.</p>

          <p class="section-label">[03] CONTA E AUTENTICAÇÃO</p>
          <p>O acesso é realizado via Pi Network OAuth. Ao autenticar, você autoriza o Prismo a receber seu identificador Pi (uid e username) para fins de sessão segura. Nenhuma senha é armazenada pelo Prismo.</p>

          <p class="section-label">[04] PROPRIEDADE INTELECTUAL DAS COMPOSIÇÕES</p>
          <p>O usuário retém todos os direitos autorais sobre as composições criadas na plataforma. O Prismo não reivindica propriedade sobre nenhum conteúdo musical produzido pelo usuário. Ao utilizar o recurso de assinatura digital, o usuário registra prova criptográfica de autoria com data e hora.</p>

          <p class="section-label">[05] PLANO DE ASSINATURA</p>
          <p>O Plano Premium é cobrado mensalmente em Pi (criptomoeda nativa da Pi Network). O acesso ao plano é ativado após confirmação da transação na blockchain Pi. Cancelamentos encerram o acesso ao término do período vigente. O Prismo não emite reembolsos em Pi.</p>

          <p class="section-label">[06] DISTRIBUIÇÃO DE CONTEÚDO</p>
          <p>Ao solicitar distribuição para plataformas externas (Spotify, Apple Music, etc.), o usuário concede ao Prismo licença não exclusiva para submeter o conteúdo em nome do artista. O usuário garante possuir todos os direitos necessários para a distribuição, incluindo samples, interpolações e colaborações. O Prismo atua como intermediário técnico e não assume responsabilidade por disputas de direitos entre distribuidoras e terceiros.</p>

          <p class="section-label">[07] CONTEÚDO PROIBIDO</p>
          <p>É vedado publicar ou distribuir conteúdo que: (a) viole direitos de terceiros; (b) contenha discurso de ódio ou material ilegal; (c) utilize samples sem licença adequada; (d) seja gerado por IA sem declaração explícita ao usuário final; (e) infrinja os Termos de Uso da Pi Network.</p>

          <p class="section-label">[08] SUSPENSÃO E ENCERRAMENTO</p>
          <p>O Prismo reserva-se o direito de suspender contas que violem estes Termos, sem aviso prévio em casos graves. Dados de composições poderão ser exportados pelo usuário antes do encerramento definitivo.</p>

          <p class="section-label">[09] LIMITAÇÃO DE RESPONSABILIDADE</p>
          <p>O Prismo não garante disponibilidade ininterrupta do serviço. Em nenhuma hipótese será responsável por perdas financeiras decorrentes de falhas de integração com Pi Network ou plataformas de distribuição externas.</p>

          <p class="section-label">[10] PI NETWORK</p>
          <p>O uso do Prismo em conjunto com a Pi Network está sujeito também aos Termos de Uso e Políticas da Pi Network (minepi.com/terms). Em caso de conflito, prevalecem os termos da Pi Network para tudo que envolva transações em Pi e autenticação Pi OAuth.</p>

          <p class="section-label">[11] ALTERAÇÕES</p>
          <p>Estes Termos podem ser atualizados a qualquer momento. Notificações serão exibidas no dashboard. O uso continuado após a publicação constitui aceite das alterações.</p>

          <p class="update-date">> ÚLTIMA ATUALIZAÇÃO: JULHO/2026</p>
        </div>

        <div class="screen-footer">
          <button (click)="goBack()" class="btn-retro">> COMPREENDIDO &lt;</button>
        </div>
      </div>
    </div>
  `,
  styles: [styleBase('#00e5ff', 'rgba(0, 229, 255, 0.15)')]
})
export class Terms {
  private readonly router = inject(Router);
  goBack() { this.router.navigate(['/']); }
}

function styleBase(neonColor: string, glowColor: string) {
  return `
    .arcade-viewport {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      background: #08090c;
      font-family: 'Press Start 2P', monospace;
      padding: 16px;
      box-sizing: border-box;
    }
    .crt-screen {
      background: #0c0f12;
      position: relative;
      width: 100%;
      max-width: 480px;
      min-height: 480px;
      padding: 24px 16px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      border: 4px solid ${neonColor};
      border-radius: 20px;
      box-shadow: 0 0 25px ${glowColor}, inset 0 0 30px rgba(0,0,0,0.9);
      margin: auto;
    }
    .scanlines {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%),
                  linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06));
      background-size: 100% 4px, 6px 100%;
      z-index: 5; pointer-events: none;
    }
    .screen-header {
      font-size: 7px; color: #4b5563; letter-spacing: 2px; text-align: center; margin-bottom: 12px;
    }
    .screen-body { z-index: 2; }
    h1 {
      color: #fff; font-size: 11px; letter-spacing: 1px; margin: 0 0 16px 0;
      text-shadow: 2px 2px #000, 0 0 8px ${neonColor}; text-align: center;
    }
    .section-label {
      color: #fff; font-size: 8px; margin: 14px 0 4px 0;
      text-shadow: 0 0 6px ${neonColor};
    }
    p {
      color: ${neonColor}; font-size: 7px; line-height: 1.9; text-align: left;
      margin: 0 0 8px 0; text-shadow: 1px 1px #000; font-family: system-ui, sans-serif;
    }
    .update-date {
      font-family: 'Press Start 2P', monospace; font-size: 6px; color: rgba(255,255,255,0.3); margin-top: 16px;
    }
    .code-scroll { max-height: 340px; overflow-y: auto; padding-right: 4px; }
    .code-scroll::-webkit-scrollbar { width: 4px; }
    .code-scroll::-webkit-scrollbar-track { background: #111; }
    .code-scroll::-webkit-scrollbar-thumb { background: ${neonColor}; border-radius: 2px; }
    .screen-footer { margin-top: 16px; }
    .btn-retro {
      background: transparent; border: none; color: #fff;
      font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;
      width: 100%; padding: 12px 0; outline: none;
      animation: textBlink 1.5s infinite steps(2);
    }
    .btn-retro:hover, .btn-retro:focus {
      color: ${neonColor}; animation: none; text-shadow: 0 0 8px ${neonColor};
    }
    @keyframes textBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  `;
}
