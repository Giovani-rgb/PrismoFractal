import { Injectable, signal } from '@angular/core';

export interface WorldData {
  name: string;
  structure: string;
  bpm: number;
  timeSignature: string;
}

export interface MelodyDnaData {
  ideology: string;
  rhythm: string;
  harmonyBase: string;
  keySignature: string;
}

export interface Phrase {
  id: string;
  text: string;
  order: number;
  stanza: number;
}

export interface ProjectData {
  id: string;
  name: string;
  world: WorldData;
  melodyDna: MelodyDnaData;
  phrases: Phrase[];
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private projectSignal = signal<ProjectData>(this.getMockProject());

  project = this.projectSignal.asReadonly();

  updateProject(data: Partial<ProjectData>): void {
    const current = this.projectSignal();
    this.projectSignal.set({ ...current, ...data });
  }

  private getMockProject(): ProjectData {
    return {
      id: 'proj_1',
      name: 'Meu Projeto',
      world: {
        name: 'Mundo das Vozes',
        structure: 'Verso - Refrão - Verso - Refrão - Ponte - Refrão',
        bpm: 120,
        timeSignature: '4/4'
      },
      melodyDna: {
        ideology: 'Esperança e Transformação',
        rhythm: 'Sincopado com swing',
        harmonyBase: 'Dó Maior com tensões ii-V-I',
        keySignature: 'Dó Maior'
      },
      phrases: [
        { id: 'p1', text: 'Verso 1 - Introdução do tema', order: 1, stanza: 1 },
        { id: 'p2', text: 'Verso 1 - Desenvolvimento narrativo', order: 2, stanza: 1 },
        { id: 'p3', text: 'Refrão - Mensagem central', order: 3, stanza: 2 },
        { id: 'p4', text: 'Verso 2 - Aprofundamento emocional', order: 5, stanza: 3 },
        { id: 'p5', text: 'Verso 2 - Conclusão parcial', order: 6, stanza: 3 },
        { id: 'p6', text: 'Refrão - Repetição reforçada', order: 7, stanza: 2 },
        { id: 'p7', text: 'Ponte - Momento de transição', order: 9, stanza: 4 }
      ]
    };
  }
}
