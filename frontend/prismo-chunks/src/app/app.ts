import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { SessionCreationExecution } from './crowdedExecultion/sessionCreat.execultion';
import { SessionRehydrationExecution } from './crowdedExecultion/sessionRehydrat.execultion';
import { SessionContext } from './context/session.context';
import { SessionTag } from './models/session.model';
import { SessionCacheService } from './private/session-cache.service'; 
import { environment } from '../environments/environment';

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
  private cacheService = inject(SessionCacheService); // Seu serviço de cache privado
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

  /**
   * FLUXO 1: CRIAÇÃO (POST)
   * Orquestra a esteira de ingestão de nova sessão.
   */
  private async runCreationFlow(): Promise<void> {
    try {
      await this.creationExecution.execute();
      this.finalizeFlow();
    } catch (err) {
      console.error('[App] ❌ Falha crítica na rota de criação:', err);
    }
  }

  /**
   * FLUXO 2: REIDRATAÇÃO (CACHE)
   * Orquestra a recuperação de integridade local via Worker ou Cache Privado.
   */
  private async runRehydrationFlow(): Promise<void> {
    try {
      // Nota: Dentro do seu rehydrationExecution, você também pode injetar o SessionCacheService
      // e usar o environment.vaultPassword para resgatar as chaves e decifrar o sessionStorage!
      await this.rehydrationExecution.execute();
      this.finalizeFlow();
    } catch (err) {
      console.error('[App] ❌ Falha na reidratação...', err);
    }
  }

  /**
   * FINALIZAÇÃO DETERMINÍSTICA
   * Salva o contexto gerado no Vault Privado usando a senha do ambiente antes do repouso.
   */
  private finalizeFlow(): void {
    const state = this.context.currentState;

    // Se o estado for REST ou OFFLINE (com dados), a aplicação pode seguir
    if (state.data && (state.tag === SessionTag.REST || state.tag === SessionTag.OFFLINE)) {

      console.log(`%c[App] ✨ Estado de Repouso Alcançado: ${state.tag}`, 'color: #6366f1; font-weight: bold;');
      console.dir(state); 

      // --- PERSISTÊNCIA NO VAULT PRIVADO ---
      // Resgata a senha definida no seu arquivo de ambiente
      const vaultKey = environment.vaultPassword; 
      
      if (vaultKey) {
        this.cacheService.saveCurrentContextToVault(vaultKey);
      } else {
        console.warn('[App] ⚠️ Senha do Vault não encontrada no arquivo environment.');
      }
      // ─────────────────────────────────────

      if (state.use_pwa_styles) {
        console.log('%c[App] 📱 PWA Mode: Active Styles Enabled.', 'color: #ec4899');
      }

      this.checkRedirect();
    } else {
      throw new Error(`[App] Bloqueio: Esteira concluída indevidamente em estado inválido: ${state.tag}`);
    }
  }

  private checkRedirect(): void {
    const currentUrl = this.router.url;
    if (currentUrl === '/' || currentUrl === '') {
      this.router.navigateByUrl('/landing');
    }
  }

  /**
   * BANNER EXPANDIDO GIGANTE
   */
  private printPrismoBanner(): void {
    const label = '  PRISMO  ';
    const engine = '  ENGINE  ';
    
    const styleLabel = 'background: #6366f1; color: white; font-weight: bold; font-size: 16px; border-radius: 4px 0 0 4px; padding: 6px 12px; font-family: monospace;';
    const styleEngine = 'background: #312e81; color: #a5b4fc; font-weight: bold; font-size: 16px; border-radius: 0 4px 4px 0; padding: 6px 12px; font-family: monospace;';
    
    console.log('\n'); 
    console.log(`%c${label}%c${engine}`, styleLabel, styleEngine);
    console.log('%c  » Deterministic Pipeline Execution Activated «  ', 'color: #818cf8; font-size: 11px; font-weight: 500; letter-spacing: 1px; padding-top: 5px;');
    console.log('%c────────────────────────────────────────────────────────', 'color: #4338ca;');
  }
}
