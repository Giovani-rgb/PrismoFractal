import { Routes } from '@angular/router';
import { whitelistGuard } from './guards/sessionWhiteList.guards';

import { Intro } from './pages/intro/intro';
import { World } from './pages/world/world';
import { Songs } from './pages/songs/songs';
import { Settings } from './pages/settings/settings';
import { Landing } from './pages/landing/landing';
import { MelodyDna } from './pages/melody-dna/melody-dna';

import { Dashboard } from './pages/dashboard/dashboard';
import { Profile } from "./pages/profile/profile";
import { Marketplace } from "./pages/marketplace/marketplace";
import { Explore } from "./pages/explore/explore";


// Novas Importações Modernas
import { Unauthorized } from './pages/unauthorized/unauthorized';
import { Privacy } from './pages/privacity/privacity';
import { Terms } from './pages/terms/terms';

export const routes: Routes = [
  // Rotas Públicas Regulamentares (Com suporte ao Guard)
  { path: '', component: Landing, canActivate: [whitelistGuard], data: { isPublic: true } },
  { path: 'landing', component: Intro, canActivate: [whitelistGuard], data: { isPublic: true } },
  { path: 'explore', component: Explore, canActivate: [whitelistGuard], data: { isPublic: true } },
  { path: 'marketplace', component: Marketplace, canActivate: [whitelistGuard], data: { isPublic: true } },
  { path: 'profile', component: Profile, canActivate: [whitelistGuard], data: { isPublic: true } },
  { path: 'privacity', component: Privacy, canActivate: [whitelistGuard], data: { isPublic: true } },
  { path: 'terms', component: Terms, canActivate: [whitelistGuard], data: { isPublic: true } },

  // Rotas Privadas Restritas
  { path: 'dashboard', component: Dashboard, canActivate: [whitelistGuard], data: { interactionModule: 'dashboard_overview' } },
  { path: 'world', component: World, canActivate: [whitelistGuard], data: { interactionModule: 'world_map' } },
  { path: 'songs', component: Songs, canActivate: [whitelistGuard], data: { interactionModule: 'song_library' } },
  { path: 'settings', component: Settings, canActivate: [whitelistGuard], data: { interactionModule: 'system_settings' } },
  { path: 'melody-dna', component: MelodyDna, canActivate: [whitelistGuard], data: { interactionModule: 'melody_analytics' } },

  // Rota de escape
  { path: 'unauthorized', component: Unauthorized }
];
