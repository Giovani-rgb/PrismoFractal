import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';

import { routes } from './app.routes';
import { sessionGatekeeper } from './services-workers/SessionPipelineOrchestrator';
import { oauthGatekeeper } from './services-workers/OAuthPipelineOrquestrator'; 
import { environment } from '../environments/environment'; 

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([sessionGatekeeper, oauthGatekeeper]) 
    ),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
  ],
};
