import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { World } from './world';

describe('World Component', () => {
  let component: World;
  let fixture: ComponentFixture<World>;

  beforeEach(async () => {
    // Mantém o ambiente estável caso o componente renderize mapas ou grids responsivos
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));

    await TestBed.configureTestingModule({
      imports: [World],
      providers: [
        provideRouter([]),     // 👈 Protege contra links/roteamentos do cenário do World
        provideHttpClient()    // 👈 Protege contra carregamento de assets ou dados geográficos externos
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(World);
    component = fixture.componentInstance;
    
    // Força o Angular a rodar o ciclo inicial (ngOnInit) de forma síncrona e segura
    fixture.detectChanges(); 
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
