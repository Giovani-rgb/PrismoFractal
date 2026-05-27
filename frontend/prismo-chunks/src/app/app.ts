import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { SessionCreationExecution } from './crowdedExecultion/sessionCreat.execultion';
import { SessionRehydrationExecution } from './crowdedExecultion/sessionRehydrat.execultion';
import { SessionContext } from './context/session.context';
import { SessionTag } from './models/session.model';
import { environment } from '../environments/environment';
// Importe o serviço que funcionará como sua camada persistente privada
import { SessionCacheService } from './private/session-cache.service'; 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  private creationExecution = inject(SessionCreationExecution);
  private rehydrationExecution = inject(SessionRehydrationExecution);
  private context = inject(SessionContext);
  private cacheService = inject(SessionCacheService); // Injeção do Cache Persistente
  private router = inject(Router);
  private titleService = inject(Title);

  async ngOnInit(): Promise<void> {
    this.printPrismoBanner();
    this.titleService.setTitle(environment.appName);

    // 1. Verificação de persistência bruta
    const hasToken = !!sessionStorage.getItem(environment.nameSessionKey);
    const state = this.context.currentState;

    switch (hasToken) {
      case false:
        console.log(`%c[App] ⚠️ '${environment.nameSessionKey}' ausente. Iniciando Rota CREATE...`, 'color: #fbbf24');
        await this.runCreationFlow();
        break;

      case true:
        console.log('%c[App] ✅ Payload detectado. Analisando Estado do Contexto...', 'color: #10b981');

        // Se os dados não estão na memória ou a Tag está em repouso inicial (VOID)
        if (!state.data || state.tag === SessionTag.VOID) {
          console.warn('[App] ❗ Memória volátil vazia. Disparando Rota REHYDRATE...');
          await this.runRehydrationFlow();
        } else {
          console.log(`[App] 🛡️ Sessão Ativa via Tag: ${state.tag}`);
          this.checkRedirect();
        }
        break;
    }
  }

  private async runCreationFlow(): Promise<void> {
    try {
      await this.creationExecution.execute();
      this.finalizeFlow();
    } catch (err) {
      console.error('[App] ❌ Falha crítica na rota de criação:', err);
    }
  }

  private async runRehydrationFlow(): Promise<void> {
    try {
      // O seu SessionRehydrationExecution poderá injetar o SessionCacheService
      // para capturar o sharedSecret salvo e descriptografar o payload do sessionStorage
      await this.rehydrationExecution.execute();
      this.finalizeFlow();
    } catch (err) {
      console.error('[App] ❌ Falha na reidratação. Iniciando Fallback de Criação...', err);
      await this.runCreationFlow();
    }
  }

  private finalizeFlow(): void {
    const state = this.context.currentState;

    if (state.data && (state.tag === SessionTag.REST || state.tag === SessionTag.OFFLINE)) {
      console.log(`%c[App] ✨ Estado de Repouso Alcançado: ${state.tag}`, 'color: #6366f1; font-weight: bold;');
      console.dir(state);

      if (state.use_pwa_styles) {
        console.log('%c[App] 📱 PWA Mode: Active Styles Enabled.', 'color: #ec4899');
      }

      this.checkRedirect();
    } else {
      throw new Error(`[App] Bloqueio: Esteira concluída em estado inválido: ${state.tag}`);
    }
  }

  private checkRedirect(): void {
    const currentUrl = this.router.url;
    if (currentUrl === '/' || currentUrl === '') {
      this.router.navigateByUrl('/landing');
    }
  }

  /**
   * BANNER EXPANDIDO (VERSÃO PREMIUM / HIGH-IMPACT)
   */
  private printPrismoBanner(): void {
    const label = '  PRISMO  ';
    const engine = '  ENGINE  ';
    
    // Estilos com fontes maiores, paddings generosos e linha demarcadora
    const styleLabel = 'background: #6366f1; color: white; font-weight: bold; font-size: 16px; border-radius: 4px 0 0 4px; padding: 6px 12px; font-family: monospace;';
    const styleEngine = 'background: #312e81; color: #a5b4fc; font-weight: bold; font-size: 16px; border-radius: 0 4px 4px 0; padding: 6px 12px; font-family: monospace;';
    
    console.log('\n'); // Espaçamento superior
    console.log(`%c${label}%c${engine}`, styleLabel, styleEngine);
    console.log('%c  » Deterministic Pipeline Execution Activated «  ', 'color: #818cf8; font-size: 11px; font-weight: 500; letter-spacing: 1px; padding-top: 5px;');
    console.log('%c────────────────────────────────────────────────────────', 'color: #4338ca;');
  }
}
