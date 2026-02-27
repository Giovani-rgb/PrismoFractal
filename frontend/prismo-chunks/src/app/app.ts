import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { SessionService } from './services/session.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  private sessionService = inject(SessionService);
  private router = inject(Router);

  ngOnInit(): void {

    console.log('[App] 🚀 Criando sessão anônima...');

    this.sessionService.create().subscribe({
      next: session => {
        console.log('[App] ✅ Sessão criada:', session);

        // redirecionamento opcional
        if (this.router.url === '/' || this.router.url === '') {
          this.router.navigateByUrl('/landing');
        }
      },
      error: err => {
        console.error('[App] ❌ Erro ao criar sessão:', err);
      }
    });

  }
}