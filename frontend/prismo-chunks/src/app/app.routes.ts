import { Routes } from '@angular/router';
import { Intro } from './intro/intro';
import { World } from './world/world';
import { Songs } from './songs/songs';
import { Settings } from './settings/settings';

export const routes: Routes = [
  { path: '', component: Intro },
  { path: 'world', component: World },
  { path: 'songs', component: Songs },
  { path: 'settings', component: Settings }
];
