import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MelodyDna } from './melody-dna';

describe('MelodyDna Component', () => {
  let component: MelodyDna;
  let fixture: ComponentFixture<MelodyDna>;

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));

    // 1. Configure o módulo e aguarde explicitamente a compilação assíncrona dos recursos (HTML/SCSS)
    await TestBed.configureTestingModule({
      imports: [MelodyDna],
      providers: [
        provideRouter([]),
        provideHttpClient()
      ]
    })
    // 👈 Força o compilador a ignorar o HTML/SCSS externo que o Node não achou
    .overrideComponent(MelodyDna, {
      set: {
        template: '',
        styles: []
      }
    })
    .compileComponents();


    // 2. Agora que os recursos foram resolvidos, criamos a fixture com segurança
    fixture = TestBed.createComponent(MelodyDna);
    component = fixture.componentInstance;
    
    fixture.detectChanges(); 
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
