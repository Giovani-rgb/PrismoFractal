import { Routes } from '@angular/router';
import { Intro } from './pages/intro/intro';
import { World } from './pages/world/world';
import { Songs } from './pages/songs/songs';
import { Settings } from './pages/settings/settings';
import { Landing } from './pages/landing/landing';
import { MelodyDna } from './pages/melody-dna/melody-dna';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: Intro },
  { path: 'dashboard', component: Dashboard },
  { path: 'world', component: World },
  { path: 'songs', component: Songs },
  { path: 'settings', component: Settings },
  { path: 'landing', component: Landing },
  { path: 'melody-dna', component: MelodyDna}
];
