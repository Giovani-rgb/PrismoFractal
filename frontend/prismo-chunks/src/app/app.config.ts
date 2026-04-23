import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

// 1. Importações do Firebase
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import { getAuth, provideAuth } from '@angular/fire/auth'; // Exemplo para Auth
import { getFirestore, provideFirestore } from '@angular/fire/firestore'; // Exemplo para Firestore

import { routes } from './app.routes';
import { sessionGatekeeper } from './services-workers/SessionPipelineOrchestrator';
import { environment } from '../environments/environment'; // 2. Importe o environment

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      // O registro PRECISA estar aqui, senão nada acontece.
      withInterceptors([sessionGatekeeper]) 
    ),
    
    // Configurações do Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAnalytics(() => getAnalytics()),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
};
