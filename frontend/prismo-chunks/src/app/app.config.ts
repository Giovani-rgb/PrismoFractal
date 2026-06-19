import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

// 1. Importações do Firebase
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import { getAuth, provideAuth } from '@angular/fire/auth'; 
import { getFirestore, provideFirestore } from '@angular/fire/firestore'; 

import { routes } from './app.routes';
import { sessionGatekeeper } from './services-workers/SessionPipelineOrchestrator';
import { oauthGatekeeper } from './services-workers/OAuthPipelineOrquestrator'; // 🚀 Importa o novo maestro exclusivo do OAuth
import { environment } from '../environments/environment'; 

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      // 🛡️ Os dois guardiões agora operam em paralelo protegendo o ecossistema
      withInterceptors([sessionGatekeeper, oauthGatekeeper]) 
    ),

    {
      provide: ErrorHandler,
      useValue: {
        handleError: (error: any) => {
          // Suprime erros internos do Pi Network SDK que sobem pelo Zone.js
          // O SDK faz XHR em Pi.init() que falha fora do Pi Browser —
          // Zone.js captura o onerror do XHR e roteia aqui.
          const stack   = error?.stack   ?? '';
          const msg     = error?.message ?? '';
          const url     = error?.config?.url ?? error?.config?.baseURL ?? '';
          const isPiErr =
            error?.name === 'AxiosError'   ||
            stack.includes('pi-sdk.js')    ||
            url.includes('minepi')         ||
            msg.toLowerCase().includes('network error') && stack.includes('pi-sdk');

          if (isPiErr) {
            console.warn('[Pi SDK] Erro XHR interno suprimido (fora do Pi Browser):', msg || error?.name);
            return;
          }
          console.error('%c❌ [RUNTIME ERROR]%c', 'background: #ef4444; color: #fff;', '', error);
        }
      }
    },

    // Configurações do Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // provideAnalytics(() => getAnalytics()), // 👈 COMENTE ESSA LINHA PARA TESTAR LOCALMENTE
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
};
