import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router'; // 1. Importado o Router aqui
import { CommonModule } from '@angular/common';
// Importação correta do Serviço Injectable
import { OAuthPiConnectExecution } from '../../crowdedExecultion/oAuthPiConnect.execultion';

interface Star {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; opacity: number; color: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements AfterViewInit, OnDestroy {
  @ViewChild('landingCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private rafId!: number;
  private titleOpacity = 0;
  private titleTime    = 0;
  private readonly MAX_STARS = 200;

  // Injeção do serviço executora do Prismo através do Angular inject()
  private oauthPiExecution = inject(OAuthPiConnectExecution);
  
  // 2. Injeção do Router do Angular usando inject()
  private router = inject(Router);

  // --- Paleta do Nicolas para consistência com o Canvas ───
  private readonly PI_GOLD = '#e29b00';
  private readonly PI_PURPLE = '#523773';

  // --- Estados do Modal e Captcha ───
  showAuthModal = false;
  currentProvider = '';
  
  // Variáveis do Captcha Antibot Matemático
  captchaNum1 = 0;
  captchaNum2 = 0;
  userCaptchaAnswer = '';
  captchaError = false;

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d', { alpha: false })!;
    this.resizeCanvas();
    this.initStars(true);
    this.animate();
  }

  ngOnDestroy() { cancelAnimationFrame(this.rafId); }

  @HostListener('window:resize')
  resizeCanvas() {
    const c = this.canvasRef.nativeElement;
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
  }

  private starColor(): string {
    const r = Math.random();
    if (r < 0.13) return this.PI_GOLD;
    if (r < 0.23) return this.PI_PURPLE;
    return '#ffffff';
  }

  private createStar(scatter = false): Star {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.4 + 0.4;
    const maxDist = Math.max(window.innerWidth, window.innerHeight);
    const dist = scatter ? Math.random() * maxDist : Math.random() * 10;
    return {
      x: Math.cos(angle) * dist, y: Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius: Math.random() * 1.2 + 0.3,
      opacity: scatter ? Math.random() : 0,
      color: this.starColor(),
    };
  }

  private initStars(scatter: boolean) {
    this.stars = Array.from({ length: this.MAX_STARS }, () => this.createStar(scatter));
  }

  private drawAccentStar(x: number, y: number, radius: number, opacity: number, color: string) {
    const pts = 5;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.translate(x, y);
    this.ctx.moveTo(0, -radius);
    for (let i = 0; i < pts; i++) {
      this.ctx.rotate(Math.PI / pts);
      this.ctx.lineTo(0, -(radius * 0.45));
      this.ctx.rotate(Math.PI / pts);
      this.ctx.lineTo(0, -radius);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    this.ctx.shadowBlur  = 16;
    this.ctx.shadowColor = color;
    this.ctx.fill();
    this.ctx.restore();
  }

  private animate() {
    const c  = this.canvasRef.nativeElement;
    const w  = c.width;
    const h  = c.height;
    const cx = w / 2;
    const cy = h * 0.30;

    const mobile = w < 480;
    const tablet = w < 768;

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);

    const grd = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.48);
    grd.addColorStop(0,   'rgba(82,55,115,0.08)');
    grd.addColorStop(0.5, 'rgba(82,55,115,0.03)');
    grd.addColorStop(1,   'transparent');
    this.ctx.fillStyle = grd;
    this.ctx.fillRect(0, 0, w, h);

    this.stars.forEach(s => {
      s.x += s.vx; s.y += s.vy;
      if (s.opacity < 1) s.opacity += 0.018;
      const sx = cx + s.x, sy = cy + s.y;
      if (sx < -5 || sx > w + 5 || sy < -5 || sy > h + 5) {
        Object.assign(s, this.createStar(false));
      } else {
        this.ctx.globalAlpha  = Math.min(s.opacity, 1);
        this.ctx.fillStyle    = s.color;
        this.ctx.shadowBlur   = s.color === '#ffffff' ? 0 : 7;
        this.ctx.shadowColor  = s.color;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });

    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur  = 0;

    this.drawAccentStar(cx - 220, cy - 72, 13, 0.75, this.PI_GOLD);
    this.drawAccentStar(cx + 240, cy + 28, 17, 0.55, this.PI_GOLD);
    this.drawAccentStar(cx + 28,  cy - 125, 8, 0.80, this.PI_GOLD);
    this.drawAccentStar(cx - 95,  cy + 105, 7, 0.45, this.PI_PURPLE);

    if (this.titleOpacity < 1) this.titleOpacity += 0.014;
    this.titleTime += 0.009;

    const chars = [
      { t: 'P', s: mobile ? 44 : tablet ? 60 : 72, x: mobile ? -94  : -158 },
      { t: 'R', s: mobile ? 37 : tablet ? 51 : 61, x: mobile ? -57  : -92  },
      { t: 'I', s: mobile ? 44 : tablet ? 60 : 72, x: mobile ? -22  : -37  },
      { t: 'S', s: mobile ? 37 : tablet ? 51 : 61, x: mobile ?  12  :  19  },
      { t: 'M', s: mobile ? 42 : tablet ? 58 : 70, x: mobile ?  52  :  82  },
      { t: 'O', s: mobile ? 48 : tablet ? 66 : 71, x: mobile ?  92  : 156  },
    ];

    this.ctx.textAlign    = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowBlur   = 0;

    chars.forEach(ch => {
      this.ctx.font = `bold ${ch.s}px 'Press Start 2P', monospace`;
      for (let i = 7; i > 0; i--) {
        let col: string;
        if (i === 1) {
          col = '#ffffff';
        } else if (i > 4) {
          col = `hsl(${Math.round((this.titleTime * 90 + ch.x * 0.6) % 360)}, 100%, 58%)`;
        } else {
          col = `hsl(${Math.round((this.titleTime * 90 + ch.x * 0.6 + 165) % 360)}, 100%, 44%)`;
        }
        this.ctx.fillStyle  = col;
        this.ctx.globalAlpha = (i === 1 ? 1 : 0.88) * this.titleOpacity;
        this.ctx.fillText(ch.t, cx + ch.x - i, cy + i);
      }
    });

    this.ctx.globalAlpha = this.titleOpacity;

    const lineW = mobile ? 118 : tablet ? 172 : 202;
    const lineY = cy + (mobile ? 60 : 80);
    const rainbowGrad = this.ctx.createLinearGradient(cx - lineW, 0, cx + lineW, 0);
    const hShift = this.titleTime * 160;
    for (let i = 0; i <= 9; i++) {
      rainbowGrad.addColorStop(i / 9, `hsl(${(hShift + i * 40) % 360}, 100%, 62%)`);
    }
    this.ctx.strokeStyle = rainbowGrad;
    this.ctx.lineWidth   = mobile ? 2 : 3;
    this.ctx.shadowBlur  = 14;
    this.ctx.shadowColor = '#fff';
    this.ctx.beginPath();
    this.ctx.moveTo(cx - lineW, lineY);
    this.ctx.lineTo(cx + lineW, lineY);
    this.ctx.stroke();

    const subY = lineY + (mobile ? 20 : 26);
    this.ctx.font        = `${mobile ? 6 : 8}px 'Press Start 2P', monospace`;
    this.ctx.textAlign   = 'center';
    this.ctx.shadowBlur  = 0;
    this.ctx.fillStyle   = `rgba(255,255,255,${0.38 * this.titleOpacity})`;
    this.ctx.globalAlpha = this.titleOpacity;
    this.ctx.fillText('UNDERGROUND  to  MAIN  STREAM', cx, subY);

    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur  = 0;

    this.rafId = requestAnimationFrame(() => this.animate());
  }

  // --- Fluxo do Modal de Login ---

  login(provider: string) {
    this.currentProvider = provider;
    this.generateCaptcha();
    this.userCaptchaAnswer = '';
    this.captchaError = false;
    this.showAuthModal = true;
  }

  private generateCaptcha() {
    this.captchaNum1 = Math.floor(Math.random() * 10) + 1;
    this.captchaNum2 = Math.floor(Math.random() * 10) + 1;
  }

  closeModal() {
    this.showAuthModal = false;
  }

  async confirmAuth() {
    const expectedAnswer = this.captchaNum1 + this.captchaNum2;
    
    if (parseInt(this.userCaptchaAnswer, 10) === expectedAnswer) {
      this.captchaError = false;
      this.showAuthModal = false;
      
      console.log(`Authenticating token through third-party provider: ${this.currentProvider}`);
      
      try {
        // Executa a esteira OAuth — par RSA-OAEP gerado internamente a cada sessão
        const result = await this.oauthPiExecution.run();
        console.log('Esteira OAuth processada com sucesso:', result);

        // 3. Redirecionamento configurado aqui após o sucesso
        // Se a sua esteira retornar algum parâmetro (ex: se result.sucesso for uma condicional), ajuste aqui.
        // Substitua 'dashboard' pela rota que você desejar deixar mapeada.
        this.router.navigate(['/dashboard']);

      } catch (pipelineError) {
        console.error('Erro na execução da esteira do Prismo:', pipelineError);
      }

    } else {
      this.captchaError = true;
      this.userCaptchaAnswer = '';
      this.generateCaptcha();
    }
  }

  onCaptchaInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.userCaptchaAnswer = input.value;
  }
}
