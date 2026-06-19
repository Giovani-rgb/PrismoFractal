import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Songs } from './songs';

describe('Songs Component', () => {
  let component: Songs;
  let fixture: ComponentFixture<Songs>;

  beforeEach(async () => {
    // Blindagem global contra falhas de layout/responsividade no jsdom
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));

    await TestBed.configureTestingModule({
      imports: [Songs],
      providers: [
        provideRouter([]),     // 👈 Protege contra navegações internas da listagem de músicas
        provideHttpClient()    // 👈 Protege contra requisições que buscam streams ou metadados de áudio
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Songs);
    component = fixture.componentInstance;
    
    // Dispara a primeira varredura do ciclo de vida para renderizar o componente
    fixture.detectChanges(); 
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
