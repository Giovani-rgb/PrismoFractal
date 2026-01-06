import { Component, inject } from '@angular/core';
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
  private sessionService = inject(SessionService);
  private projectService = inject(ProjectService);
  private router = inject(Router);

  constructor() {
    this.sessionService.read().subscribe({
      next: session => {
        console.log('[SESSION]', session);

        if (this.router.url === '/') {
          this.router.navigate(['/landing']);
        }
      },
      error: err => {
        console.error('Erro ao inicializar sessão', err);
      }
    });
  }
}
