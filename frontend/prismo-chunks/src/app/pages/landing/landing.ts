import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface BackgroundStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements AfterViewInit {
  @ViewChild('landingCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  
  // Gerenciamento do fundo animado
  private stars: BackgroundStar[] = [];
  private readonly MAX_STARS = 150; 

  constructor(private router: Router) {}

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d', { alpha: false })!;
    this.resizeCanvas();
    this.initStars(true); // Inicializa preenchendo a tela inteira
    this.animate();
  }

  @HostListener('window:resize')
  resizeCanvas() {
    this.canvasRef.nativeElement.width = window.innerWidth;
    this.canvasRef.nativeElement.height = window.innerHeight;
  }

  /**
   * Inicializa ou regenera o array de estrelas em posições aleatórias
   */
  private initStars(scatter: boolean) {
    this.stars = [];
    for (let i = 0; i < this.MAX_STARS; i++) {
      this.stars.push(this.createStar(scatter));
    }
  }

  /**
   * Cria uma estrela com vetor de movimento baseado em ângulo para simular a explosão para fora
   */
  private createStar(scatter = false): BackgroundStar {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.5 + 0.5; // Velocidade de dispersão
    
    // Se 'scatter' for true, espalha pela tela (evita que o app comece sem estrelas nas bordas)
    // Se falso, a estrela "nasce" bem perto do centro do fluxo
    const maxDist = Math.max(window.innerWidth, window.innerHeight);
    const dist = scatter ? Math.random() * maxDist : Math.random() * 15;

    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 1.2 + 0.4,
      opacity: scatter ? Math.random() : 0 // Fade-in para as novas estrelas que surgem
    };
  }

  /**
   * Desenha estrelas de 5 pontas de destaque (estáticas/hero)
   */
  private drawStar(x: number, y: number, radius: number, opacity: number) {
    const points = 5;
    const inset = 0.5; 

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.translate(x, y);
    this.ctx.moveTo(0, 0 - radius);

    for (let i = 0; i < points; i++) {
      this.ctx.rotate(Math.PI / points);
      this.ctx.lineTo(0, 0 - (radius * inset));
      this.ctx.rotate(Math.PI / points);
      this.ctx.lineTo(0, 0 - radius);
    }

    this.ctx.closePath();
    this.ctx.fillStyle = `rgba(0, 229, 255, ${opacity})`;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#00e5ff';
    this.ctx.fill();
    this.ctx.restore();
  }

  private animate() {
    const w = this.canvasRef.nativeElement.width;
    const h = this.canvasRef.nativeElement.height;

    const centerX = w / 2;
    const centerY = (h * (2 / 3)) / 2;

    // Fundo Preto Absoluto 
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);

    // --- 1. RENDERIZAR FUNDO ANIMADO (STARFIELD) ---
    this.stars.forEach(star => {
      // Move a estrela para fora baseado em sua velocidade direcional
      star.x += star.vx;
      star.y += star.vy;

      // Suaviza o surgimento (fade-in) para não brotar do nada no centro
      if (star.opacity < 1) {
        star.opacity += 0.02;
      }

      const screenX = centerX + star.x;
      const screenY = centerY + star.y;

      // Se a estrela cruzar a borda da tela, ela "morre" e renasce no centro
      if (screenX < 0 || screenX > w || screenY < 0 || screenY > h) {
        Object.assign(star, this.createStar(false));
      } else {
        this.ctx.fillStyle = `rgba(0, 229, 255, ${star.opacity})`;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, star.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });

    // --- 2. ESTRELAS FIXAS DE DESTAQUE ---
    this.drawStar(centerX - 210, centerY - 70, 10, 0.8);
    this.drawStar(centerX + 220, centerY + 25, 14, 0.6);
    this.drawStar(centerX + 25, centerY - 120, 7, 0.8);

    // --- 3. LETRAS COM EXTRUSÃO 3D ---
    const chars = [
      { t: 'P', s: 62, x: -130 },
      { t: 'R', s: 52, x: -75  },
      { t: 'I', s: 62, x: -30  },
      { t: 'S', s: 52, x: 15    },
      { t: 'M', s: 58, x: 65   },
      { t: 'O', s: 68, x: 125  }
    ];

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowBlur = 0; // Reset do efeito blur para o texto ficar nítido

    chars.forEach(c => {
      this.ctx.font = `bold ${c.s}px 'Press Start 2P'`;

      for (let i = 7; i > 0; i--) {
        this.ctx.fillStyle = i === 1 ? '#ffffff' : i > 4 ? '#00e5ff' : '#ff0055';
        this.ctx.fillText(c.t, centerX + c.x - i, centerY + i); 
      }
    });

    // --- 4. LINHA DE BASE TÉCNICA (Ajustada para 340px) ---
    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    // De -170 a +170 em relação ao centro garante o tamanho exato de 340px
    this.ctx.moveTo(centerX - 170, centerY + 75);
    this.ctx.lineTo(centerX + 170, centerY + 75);
    this.ctx.stroke();

    requestAnimationFrame(() => this.animate());
  }

  login(provider: string) {
    this.router.navigate(['/dashboard']); 
  }
}
