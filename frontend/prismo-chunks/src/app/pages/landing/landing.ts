import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

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

  constructor(private router: Router) {}

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d', { alpha: false })!;
    this.resizeCanvas();
    this.animate();
  }

  @HostListener('window:resize')
  resizeCanvas() {
    this.canvasRef.nativeElement.width = window.innerWidth;
    this.canvasRef.nativeElement.height = window.innerHeight;
  }

  /**
   * Desenha estrelas de 5 pontas geometricamente perfeitas.
   * Ajustado para pontas bem definidas.
   */
  private drawStar(x: number, y: number, radius: number, opacity: number) {
    const points = 5;
    // O inset controla a "profundidade" das pontas. 
    // 0.5 cria uma estrela de 5 pontas padrão e bem definida.
    const inset = 0.5; 

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.translate(x, y);
    // Começa no topo
    this.ctx.moveTo(0, 0 - radius);

    for (let i = 0; i < points; i++) {
      // Rotaciona para a ponta interna
      this.ctx.rotate(Math.PI / points);
      // Desenha linha até a ponta interna (menor)
      this.ctx.lineTo(0, 0 - (radius * inset));
      // Rotaciona para a ponta externa
      this.ctx.rotate(Math.PI / points);
      // Desenha linha até a ponta externa (maior)
      this.ctx.lineTo(0, 0 - radius);
    }

    this.ctx.closePath();

    // Estilo da estrela: Ciano com brilho
    this.ctx.fillStyle = `rgba(0, 229, 255, ${opacity})`;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#00e5ff';
    this.ctx.fill();

    this.ctx.restore();
  }

  // ... imports permanecem iguais

    private animate() {
      const w = this.canvasRef.nativeElement.width;
      const h = this.canvasRef.nativeElement.height;

      const centerX = w / 2;
      const centerY = (h * (2 / 3)) / 2;

      // Fundo Preto Absoluto (Zero cor de fundo)
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, w, h);

      // Estrelas com pontas definidas (Meio-termo de tamanho)
      this.drawStar(centerX - 210, centerY - 70, 10, 0.8);
      this.drawStar(centerX + 220, centerY + 25, 14, 0.6);
      this.drawStar(centerX + 25, centerY - 120, 7, 0.8);

      // --- MEIO-TERMO: Letras com tamanho equilibrado ---
      // Aumentamos o 's' para um peso visual mais imponente
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
      this.ctx.shadowBlur = 0;

      chars.forEach(c => {
        this.ctx.font = `bold ${c.s}px 'Press Start 2P'`;

        // Extrusão de 7 camadas (Direita -> Esquerda)
        for (let i = 7; i > 0; i--) {
          // Cores do Bloco 3D
          this.ctx.fillStyle = i === 1 ? '#ffffff' : i > 4 ? '#00e5ff' : '#ff0055';
          this.ctx.fillText(c.t, centerX + c.x - i, centerY + i); 
        }
      });

      // Linha de Base técnica (Proporcional ao novo tamanho)
      this.ctx.strokeStyle = '#00e5ff';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - 210, centerY + 75);
      this.ctx.lineTo(centerX + 210, centerY + 75);
      this.ctx.stroke();

      requestAnimationFrame(() => this.animate());
    }

  // ... restante da classe


  login(provider: string) {
    this.router.navigate(['/dashboard']); 
  }
}

  


