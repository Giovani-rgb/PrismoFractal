import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Settings } from './settings';

describe('Settings Component', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  beforeEach(async () => {
    // Blindagem global contra falhas de layout/responsividade no jsdom
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));

    // Compilação assíncrona robusta resolvendo os arquivos externos .html e .scss
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideRouter([]),     // 👈 Protege botões de voltar ou sair das configurações
        provideHttpClient()    // 👈 Protege caso salve ou mude configurações via API
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    
    // Dispara a primeira varredura síncrona do ciclo de vida (ngOnInit)
    fixture.detectChanges(); 
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
