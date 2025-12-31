import { Routes } from '@angular/router';
import { Intro } from './intro/intro';
import { World } from './world/world';
import { Songs } from './songs/songs';
import { Settings } from './settings/settings';
import { Landing } from './landing/landing';
import { MelodyDna } from './melody-dna/melody-dna';

export const routes: Routes = [
  { path: '', component: Intro },
  { path: 'world', component: World },
  { path: 'songs', component: Songs },
  { path: 'settings', component: Settings },
  { path: 'landing', component: Landing },
  { path: 'melody-dna', component: MelodyDna}
];
