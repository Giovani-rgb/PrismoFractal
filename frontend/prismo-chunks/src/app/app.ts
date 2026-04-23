import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { SessionCreationExecution } from './crowdedExecultion/sessionCreat.execultion';
import { SessionRehydrationExecution } from './crowdedExecultion/sessionRehydrat.execultion';
import { SessionContext } from './context/session.context';
import { SessionTag } from './models/session.model';
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
      // Aqui o Prismo poderia redirecionar para uma página de erro global
    }
  }

  /**
   * FLUXO 2: REIDRATAÇÃO (CACHE)
   * Orquestra a recuperação de integridade local via Worker.
   */
  private async runRehydrationFlow(): Promise<void> {
    try {
      await this.rehydrationExecution.execute();
      this.finalizeFlow();
    } catch (err) {
      console.error('[App] ❌ Falha na reidratação. Iniciando Fallback de Criação...', err);
      await this.runCreationFlow();
    }
  }

  /**
   * FINALIZAÇÃO DETERMINÍSTICA
   * Valida se a esteira entregou o selo REST ou se estamos operando OFFLINE.
   */
  /**
   * FINALIZAÇÃO DETERMINÍSTICA
   * Valida se a esteira entregou o selo REST ou se estamos operando OFFLINE.
   */
  private finalizeFlow(): void {
    const state = this.context.currentState;

    // Se o estado for REST ou OFFLINE (com dados), a aplicação pode seguir
    if (state.data && (state.tag === SessionTag.REST || state.tag === SessionTag.OFFLINE)) {

      // LOG DE AUDITORIA DO CONTEXTO (Pós-Rest)
      console.log(`%c[App] ✨ Estado de Repouso Alcançado: ${state.tag}`, 'color: #6366f1; font-weight: bold;');
      console.dir(state); // Mostra o objeto PrismoSessionState completo no console

      // Feedback visual de PWA para 340px
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

  private printPrismoBanner(): void {
    const label = ' PRISMO ';
    const engine = ' ENGINE ';
    const styleLabel = 'background: #6366f1; color: white; font-weight: bold; border-radius: 3px 0 0 3px; padding: 2px 5px;';
    const styleEngine = 'background: #312e81; color: #a5b4fc; font-weight: normal; border-radius: 0 3px 3px 0; padding: 2px 5px;';

    console.log(`%c${label}%c${engine}`, styleLabel, styleEngine);
    console.log('%cInitializing deterministic pipeline...', 'color: #888; font-size: 10px; font-style: italic;');
  }
}
