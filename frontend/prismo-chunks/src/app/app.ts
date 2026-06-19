import { Component, inject, OnInit, NgZone } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { SessionCreationExecution } from './crowdedExecultion/sessionCreat.execultion';
import { SessionRehydrationExecution } from './crowdedExecultion/sessionRehydrat.execultion';
import { SessionContext } from './context/session.context';
import { SessionTag } from './models/session.model';
import { SessionCacheService } from './private/session-cache.service'; 
import { environment } from '../environments/environment';
import { AppError, ErrorAccumulator } from './models/error.model'; 

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
  private cacheService = inject(SessionCacheService);
  private router = inject(Router);
  private titleService = inject(Title);
  private ngZone = inject(NgZone);

  /**
   * Inicializa o Acumulador de Erros focado no contexto do ciclo de vida da App
   */
  public errorTracker = new ErrorAccumulator('AppInitialization');

  async ngOnInit(): Promise<void> {
    this.printPrismoBanner();
    this.titleService.setTitle(environment.appName);

    // --- INTEGRAÇÃO ECOSSISTEMA PI NETWORK ---
    // Pi.init() é executado FORA da zona do Angular para que erros de XHR
    // do SDK (AxiosError: Network Error) não sejam capturados pelo Zone.js
    // e não subam até o ErrorHandler do Angular.
    this.ngZone.runOutsideAngular(() => {
      try {
        if (typeof window.Pi?.init === 'function') {
          window.Pi.init({ version: '2.0', sandbox: true });
          window.__piSdkReady = true;
          console.log('%c[App] 🌐 Pi SDK inicializado (fora da zona Angular).', 'color: #eab308; font-weight: bold;');
        } else {
          window.__piSdkReady = false;
          console.warn('[App] ⚠️ window.Pi não disponível. Execute no Pi Browser para autenticação real.');
        }
      } catch (e: any) {
        window.__piSdkReady = false;
        console.warn('[App] ⚠️ Pi SDK: falha no init —', e?.message ?? e);
      }
    });
    // ─────────────────────────────────────────

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
    } catch (err: any) {
      console.error('[App] ❌ Falha crítica na rota de criação:', err);
      
      if (err instanceof AppError) {
        this.errorTracker.add(err);
      } else {
        this.errorTracker.add(
          new AppError(
            err?.message || 'Falha inesperada na esteira de criação', 
            'CLIENT_ERROR', 
            err?.status
          )
        );
      }
    }
  }

  /**
   * FLUXO 2: REIDRATAÇÃO (CACHE)
   * Orquestra a recuperação de integridade local via Worker ou Cache Privado.
   */
  private async runRehydrationFlow(): Promise<void> {
    try {
      await this.rehydrationExecution.execute();
      this.finalizeFlow();
    } catch (err: any) {
      console.error('[App] ❌ Falha na reidratação...', err);
      
      if (err instanceof AppError) {
        this.errorTracker.add(err);
      } else {
        this.errorTracker.add(
          new AppError(
            err?.message || 'Falha crítica ao reidratar cache da sessão', 
            'NETWORK_ERROR', 
            err?.status
          )
        );
      }
    }
  }

  /**
   * FINALIZAÇÃO DETERMINÍSTICA
   * Salva o contexto gerado no Vault Privado usando a senha do ambiente antes do repouso.
   */
  private finalizeFlow(): void {
    const state = this.context.currentState;

    if (state.data && (state.tag === SessionTag.REST || state.tag === SessionTag.OFFLINE)) {

      console.log(`%c[App] ✨ Estado de Repouso Alcançado: ${state.tag}`, 'color: #6366f1; font-weight: bold;');
      console.dir(state); 

      // --- PERSISTÊNCIA NO VAULT PRIVADO ---
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
      const stateError = new AppError(
        `Bloqueio: Esteira concluída indevidamente em estado inválido: ${state.tag}`,
        'CLIENT_ERROR'
      );
      this.errorTracker.add(stateError);
      throw stateError;
    }
  }

  /**
   * Redireciona de forma segura preservando parâmetros de consulta de ecossistemas (como ?sandbox=true)
   */
  private checkRedirect(): void {
    const currentUrl = this.router.url.split('?')[0];
    if (currentUrl === '/' || currentUrl === '') {
      this.router.navigate(['/'], { 
        queryParamsHandling: 'merge',
        replaceUrl: true 
      });
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

  // =========================================================================
  // METRICAS E CONTAGEM DE ERROS (Tratamento Isolado)
  // =========================================================================

  public get totalErrors(): number {
    return this.errorTracker.errors.length;
  }

  public get hasInitializationFailed(): boolean {
    return this.errorTracker.hasErrors;
  }
}
