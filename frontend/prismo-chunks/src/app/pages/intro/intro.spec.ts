import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Intro } from './intro';

describe('Intro Component', () => {
  let component: Intro;
  let fixture: ComponentFixture<Intro>;

  beforeEach(async () => {
    // Blindagem global contra checagens de layout ou mídia na inicialização
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));

    // Compilação assíncrona do HTML/SCSS externo
    await TestBed.configureTestingModule({
      imports: [Intro],
      providers: [
        provideRouter([]),     // 👈 Protege se a introdução pular automaticamente para outra rota (ex: /landing)
        provideHttpClient()    // 👈 Protege caso carregue alguma config ou texto externo
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Intro);
    component = fixture.componentInstance;
    
    // Dispara o ciclo de vida inicial do Angular com segurança
    fixture.detectChanges(); 
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
