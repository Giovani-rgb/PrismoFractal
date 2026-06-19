import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Landing } from './landing';

describe('Landing Component', () => {
  let component: Landing;
  let fixture: ComponentFixture<Landing>;
  let router: Router;

  beforeEach(async () => {
    // 1. Blindagem global contra checagens de layout (matchMedia)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));

    // 2. Controla o loop de animação para não travar a CPU do teste
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      // Retorna um ID fictício imediatamente em vez de agendar um loop real no Node
      return 123; 
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    // 3. 🛡️ MOCK COMPLETO DO CANVAS CONTEXT 2D
    // Simula todos os métodos matemáticos e de desenho que o Prismo usa na Landing
    const mockGradient = { addColorStop: vi.fn() };
    const mockContext2D = {
      fillStyle: '',
      strokeStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      lineWidth: 0,
      globalAlpha: 1,
      shadowBlur: 0,
      shadowColor: '',
      
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      
      // Retornam os objetos de gradiente mockados para evitar erros de encadeamento
      createRadialGradient: vi.fn().mockReturnValue(mockGradient),
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
    };

    // Injeta o mock diretamente no protótipo do elemento Canvas do jsdom
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId: string) => {
      if (contextId === '2d') {
        return mockContext2D as unknown as CanvasRenderingContext2D;
      }
      return null;
    });

    await TestBed.configureTestingModule({
      imports: [Landing],
      providers: [
        provideRouter([]) // Configura um roteador limpo para capturar o método de login
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Landing);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create - deve instanciar o componente e inicializar o motor gráfico de estrelas', () => {
    // Aciona o ngAfterViewInit e consequentemente a renderização inicial do canvas
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('deve recalcular as dimensões do canvas ao disparar um evento de redimensionamento da janela', () => {
    fixture.detectChanges();
    
    // Altera o tamanho simulado da tela
    window.innerWidth = 1024;
    window.innerHeight = 768;
    
    // Dispara o @HostListener('window:resize') nativo do Angular
    window.dispatchEvent(new Event('resize'));
    
    expect(component.canvasRef.nativeElement.width).toBe(1024);
    expect(component.canvasRef.nativeElement.height).toBe(768);
  });

  it('deve navegar para a rota de dashboard quando o método de login for acionado', () => {
    fixture.detectChanges();
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.login('any_provider');

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });
});
