import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements AfterViewInit, OnDestroy {
  @ViewChild('landingCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private rafId!: number;
  private titleOpacity = 0;
  private readonly MAX_STARS = 180;

  constructor(private router: Router) {}

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d', { alpha: false })!;
    this.resizeCanvas();
    this.initStars(true);
    this.animate();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.rafId);
  }

  @HostListener('window:resize')
  resizeCanvas() {
    const c = this.canvasRef.nativeElement;
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
  }

  private starColor(): string {
    const r = Math.random();
    if (r < 0.12) return '#00e5ff';  // cyan
    if (r < 0.17) return '#ff0055';  // red accent (rare)
    if (r < 0.22) return '#ffe600';  // yellow accent (rare)
    return '#ffffff';                 // white
  }

  private createStar(scatter = false): Star {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.2 + 0.4;
    const maxDist = Math.max(window.innerWidth, window.innerHeight);
    const dist = scatter ? Math.random() * maxDist : Math.random() * 10;

    return {
      x:       Math.cos(angle) * dist,
      y:       Math.sin(angle) * dist,
      vx:      Math.cos(angle) * speed,
      vy:      Math.sin(angle) * speed,
      radius:  Math.random() * 1.1 + 0.3,
      opacity: scatter ? Math.random() : 0,
      color:   this.starColor(),
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
    this.ctx.shadowBlur = 14;
    this.ctx.shadowColor = color;
    this.ctx.fill();
    this.ctx.restore();
  }

  private animate() {
    const c  = this.canvasRef.nativeElement;
    const w  = c.width;
    const h  = c.height;
    const cx = w / 2;
    const cy = h * 0.30; // Title sits at top 30% of screen

    // Background
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);

    // Subtle radial glow behind title
    const grd = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.45);
    grd.addColorStop(0,   'rgba(0,229,255,0.045)');
    grd.addColorStop(0.5, 'rgba(0,229,255,0.018)');
    grd.addColorStop(1,   'transparent');
    this.ctx.fillStyle = grd;
    this.ctx.fillRect(0, 0, w, h);

    // Starfield
    this.stars.forEach(s => {
      s.x += s.vx;
      s.y += s.vy;
      if (s.opacity < 1) s.opacity += 0.018;

      const sx = cx + s.x;
      const sy = cy + s.y;

      if (sx < -5 || sx > w + 5 || sy < -5 || sy > h + 5) {
        Object.assign(s, this.createStar(false));
      } else {
        this.ctx.globalAlpha = Math.min(s.opacity, 1);
        this.ctx.fillStyle = s.color;
        this.ctx.shadowBlur = s.color === '#ffffff' ? 0 : 6;
        this.ctx.shadowColor = s.color;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });

    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur  = 0;

    // Accent stars
    this.drawAccentStar(cx - 195, cy - 65, 11, 0.75, '#00e5ff');
    this.drawAccentStar(cx + 210, cy + 22,  15, 0.55, '#00e5ff');
    this.drawAccentStar(cx + 22,  cy - 110, 7,  0.80, '#ffe600');
    this.drawAccentStar(cx - 80,  cy + 95,  6,  0.45, '#ff0055');

    // Fade-in title on startup
    if (this.titleOpacity < 1) this.titleOpacity += 0.016;

    // PRISMO — responsive font size
    const mobile = w < 480;
    const tablet = w < 768;
    const chars = [
      { t: 'P', s: mobile ? 38 : tablet ? 52 : 62, x: mobile ? -78  : -130 },
      { t: 'R', s: mobile ? 32 : tablet ? 44 : 52, x: mobile ? -47  : -75  },
      { t: 'I', s: mobile ? 38 : tablet ? 52 : 62, x: mobile ? -18  : -30  },
      { t: 'S', s: mobile ? 32 : tablet ? 44 : 52, x: mobile ?   9  :  15  },
      { t: 'M', s: mobile ? 36 : tablet ? 50 : 58, x: mobile ?  38  :  65  },
      { t: 'O', s: mobile ? 42 : tablet ? 56 : 68, x: mobile ?  74  : 125  },
    ];

    this.ctx.textAlign    = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowBlur   = 0;

    chars.forEach(c => {
      this.ctx.font = `bold ${c.s}px 'Press Start 2P', monospace`;
      for (let i = 7; i > 0; i--) {
        const col = i === 1 ? '#ffffff' : i > 4 ? '#00e5ff' : '#ff0055';
        this.ctx.globalAlpha = (i === 1 ? 1 : 0.85) * this.titleOpacity;
        this.ctx.fillText(c.t, cx + c.x - i, cy + i);
      }
    });

    this.ctx.globalAlpha = this.titleOpacity;

    // Baseline
    const lineW = mobile ? 100 : tablet ? 150 : 175;
    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.lineWidth   = mobile ? 1.5 : 2.5;
    this.ctx.shadowBlur  = 8;
    this.ctx.shadowColor = '#00e5ff';
    this.ctx.beginPath();
    this.ctx.moveTo(cx - lineW, cy + (mobile ? 50 : 68));
    this.ctx.lineTo(cx + lineW, cy + (mobile ? 50 : 68));
    this.ctx.stroke();

    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur  = 0;

    this.rafId = requestAnimationFrame(() => this.animate());
  }

  login(provider: string) {
    this.router.navigate(['/dashboard']);
  }
}
