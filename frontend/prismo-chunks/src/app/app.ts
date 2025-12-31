import { Component, effect, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { SessionService } from './services/session.service';
import { ProjectService } from './services/project.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  sessionService = inject(SessionService);
  projectService = inject(ProjectService);
  router = inject(Router);

  constructor() {
    effect(() => {
      const session = this.sessionService.session();
      if (session && this.router.url === '/') {
        this.router.navigate(['/dashboard']);
      }
    });
  }
}
