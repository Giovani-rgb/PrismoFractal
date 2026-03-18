import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  projectService = inject(ProjectService);
  sessionService = inject(SessionService);
  worldOpen = true;
  dnaOpen = false;


  get project() {
    return this.projectService.project();
  }

  

  get stanzas() {
    if (!this.project) return [];
    return Array.from(
      { length: Math.max(...this.project.phrases.map(p => p.stanza)) },
      (_, i) => i + 1
    );
  }

  getPhrasesForStanza(stanzaNum: number) {
    return this.project.phrases.filter(p => p.stanza === stanzaNum);
  }
}
