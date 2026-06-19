import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  template: `
    
    
    <div class="arcade-viewport">
      <div class="crt-screen danger-theme">
        <div class="scanlines"></div>
        
        <div class="screen-header">ERROR_403</div>
        
        <div class="screen-body">
          <div class="pixel-art">👾</div>
          <h1>ACESSO NEGADO</h1>
          <p class="pixel-desc">ESTEIRA DE SEGURANCA: SEU PERFIL NAO POSSUI CHAVE PARA ESTE MODULO OU SESSAO ISOLADA ATIVA.</p>
        </div>

        <div class="screen-footer">
          <button (click)="goBack()" class="btn-retro">> VOLTAR <</button>
        </div>
      </div>
    </div>
  `,
  styles: [styleBase('#f43f5e', 'rgba(244, 63, 94, 0.15)')]
})
export class Unauthorized {
  private readonly router = inject(Router);
  

  goBack() { this.router.navigate(['/']); }
}

function styleBase(neonColor: string, glowColor: string) {
  return `
    /* VIEWPORT MOBILE FIRST */
    .arcade-viewport {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #08090c;
      font-family: 'Press Start 2P', monospace;
      padding: 16px;
      box-sizing: border-box;
    }

    /* O SEGREDO: Moldura estilo Tela de Console Portátil Curvada */
    .crt-screen {
      background: #0c0f12;
      position: relative;
      width: 100%;
      max-width: 360px;
      min-height: 480px;
      padding: 24px 16px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;

      /* Bordas Arredondadas Simulando Pixels em Escada */
      border: 4px solid ${neonColor};
      border-radius: 20px; 
      box-shadow: 
        0 0 25px ${glowColor},
        inset 0 0 30px rgba(0, 0, 0, 0.9);
    }

    /* Linhas de Varredura de TV Antiga / Monitor de Tubo */
    .scanlines {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      background-size: 100% 4px, 6px 100%;
      z-index: 5;
      pointer-events: none;
    }

    .screen-header {
      font-size: 8px;
      color: #4b5563;
      letter-spacing: 2px;
      text-align: center;
    }

    .screen-body {
      text-align: center;
      margin: auto 0;
      z-index: 2;
    }

    .pixel-art {
      font-size: 28px;
      margin-bottom: 16px;
      animation: float 2s infinite ease-in-out;
    }

    h1 {
      color: #fff;
      font-size: 12px;
      letter-spacing: 1px;
      margin: 0 0 20px 0;
      text-shadow: 2px 2px #000, 0 0 8px ${neonColor};
    }

    .pixel-desc, p {
      color: ${neonColor};
      font-size: 8px;
      line-height: 1.8;
      text-align: left;
      margin: 0 0 12px 0;
      text-shadow: 1px 1px #000;
    }

    .code-scroll {
      max-height: 260px;
      overflow-y: auto;
      padding-right: 4px;
    }

    /* BOTÃO ESTILO ARCADE (PISCA ATÉ PASSAR O MOUSE) */
    .btn-retro {
      background: transparent;
      border: none;
      color: #fff;
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      cursor: pointer;
      width: 100%;
      padding: 12px 0;
      outline: none;
      animation: textBlink 1.5s infinite steps(2);
    }

    .btn-retro:hover, .btn-retro:focus {
      color: ${neonColor};
      animation: none;
      text-shadow: 0 0 8px ${neonColor};
    }

    /* ANIMAÇÕES RETRO CURVAS */
    @keyframes textBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
  `;
}