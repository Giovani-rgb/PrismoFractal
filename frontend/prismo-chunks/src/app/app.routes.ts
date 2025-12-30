import { Routes } from '@angular/router';
import { Intro } from './intro/intro';
import { World } from './world/world';

export const routes: Routes = [
  { path: '', component: Intro },
  { path: 'world', component: World },
  { path: 'songs', component: Intro }
];
