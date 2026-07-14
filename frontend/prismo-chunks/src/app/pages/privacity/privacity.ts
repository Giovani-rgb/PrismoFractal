import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  template: `
    <div class="arcade-viewport">
      <div class="crt-screen success-theme">
        <div class="scanlines"></div>

        <div class="screen-header">PRIVACY_LOG // v1.0 — PRISMO PLATFORM</div>

        <div class="screen-body code-scroll">
          <h1>POLÍTICA DE PRIVACIDADE</h1>

          <p class="section-label">[01] DADOS COLETADOS</p>
          <p>Ao autenticar via Pi Network OAuth, coletamos: identificador único Pi (uid), nome de usuário Pi (username) e, opcionalmente, o endereço de e-mail fornecido voluntariamente pelo usuário durante o onboarding. Não coletamos senhas, documentos pessoais ou dados de pagamento diretamente — transações em Pi são processadas pela Pi Network.</p>

          <p class="section-label">[02] INTEGRAÇÃO PI NETWORK</p>
          <p>A autenticação é realizada exclusivamente via Pi Network OAuth 2.0. Os dados de sessão transitam cifrados pelo protocolo Diffie-Hellman (AES-256-GCM) entre cliente e servidor. O Prismo não acessa seu saldo Pi, transações passadas ou outros dados da carteira Pi além do uid e username autorizados no escopo OAuth.</p>
          <p>A política de privacidade da Pi Network se aplica aos dados gerenciados por ela. Consulte: minepi.com/privacy</p>

          <p class="section-label">[03] COMO USAMOS OS DADOS</p>
          <p>> Identificação da sessão do usuário na plataforma.</p>
          <p>> Personalização do perfil do estúdio musical.</p>
          <p>> Associação de composições e playlists à conta.</p>
          <p>> Processamento de assinatura Premium via Pi Network.</p>
          <p>> Envio de e-mail de confirmação de cadastro (quando fornecido).</p>

          <p class="section-label">[04] SEGURANÇA DOS DADOS</p>
          <p>Cada sessão utiliza um par de chaves Diffie-Hellman efêmero — o shared secret é gerado por sessão e descartado ao encerrar. Todos os payloads entre cliente e servidor são cifrados com AES-256-GCM. A autenticação Pi adiciona uma camada RSA-OAEP sobre o canal DH. Dados em repouso no banco de dados são armazenados em servidores Supabase (PostgreSQL) com criptografia em disco.</p>

          <p class="section-label">[05] COMPARTILHAMENTO COM TERCEIROS</p>
          <p>O Prismo não vende, troca ou aluga dados pessoais a terceiros. Dados são compartilhados apenas: (a) com plataformas de distribuição musical mediante solicitação explícita do usuário; (b) com a Pi Network para verificação de transações; (c) quando exigido por lei.</p>

          <p class="section-label">[06] RETENÇÃO DE DADOS</p>
          <p>Sessões expiram automaticamente após 30 dias sem atividade. O usuário pode solicitar exclusão completa de sua conta e dados associados a qualquer momento. Dados de transações Pi são mantidos por 12 meses para fins de auditoria conforme políticas da Pi Network.</p>

          <p class="section-label">[07] SEUS DIREITOS</p>
          <p>> Acesso: solicite uma cópia dos dados que mantemos.</p>
          <p>> Retificação: corrija dados imprecisos via configurações de perfil.</p>
          <p>> Exclusão: encerre sua conta para remoção dos dados.</p>
          <p>> Portabilidade: exporte suas composições antes de encerrar.</p>

          <p class="section-label">[08] COOKIES E ARMAZENAMENTO LOCAL</p>
          <p>O Prismo utiliza sessionStorage e localStorage apenas para manter a sessão ativa e preferências locais (tema, volume, refill de tempo). Nenhum cookie de rastreamento de terceiros é utilizado.</p>

          <p class="section-label">[09] ALTERAÇÕES NESTA POLÍTICA</p>
          <p>Atualizações serão comunicadas via banner no dashboard com antecedência mínima de 7 dias. O uso continuado após a vigência constitui aceite das mudanças.</p>

          <p class="update-date">> ÚLTIMA ATUALIZAÇÃO: JULHO/2026</p>
        </div>

        <div class="screen-footer">
          <button (click)="goBack()" class="btn-retro">> FECHAR &lt;</button>
        </div>
      </div>
    </div>
  `,
  styles: [styleBase('#00ff66', 'rgba(0, 255, 102, 0.15)')]
})
export class Privacy {
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
