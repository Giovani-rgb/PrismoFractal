import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-world',
  imports: [CommonModule, FormsModule],
  templateUrl: './world.html',
  styleUrl: './world.scss',
})
export class World {

  step = 1;

  world = {
    name: '',
    template: '',
    seed: '',
    bpm: 120,
    timeSignature: '4/4'
  };

  readonly PHRASES_PER_SECTION = 4;

  readonly TEMPLATES: Record<string, string[]> = {
    basic: [
      'Chorus',
      'Versus',
      'Pre-Chorus',
      'Chorus',
      'Verso 2',
      'Ponte',
      'Desfecho'
    ],
    simple: [
      'Versus',
      'Chorus',
      'Versus',
      'Chorus'
    ],
    free: []
  };

  next() {
    if (this.step === 2) {
      this.applyTemplate();
    }

    if (this.step < 5) {
      this.step++;
    }
  }

  back() {
    if (this.step > 1) {
      this.step--;
    }
  }

  applyTemplate() {
    const structure = this.TEMPLATES[this.world.template];

    if (!structure || structure.length === 0) {
      this.world.seed = '';
      return;
    }

    this.world.seed = structure
      .map(section => {
        const phrases = Array.from(
          { length: this.PHRASES_PER_SECTION },
          (_, i) => `(Frase ${i + 1})`
        ).join('\n');

        return `[${section}]\n${phrases}`;
      })
      .join('\n\n');
  }

  createWorld() {
    console.log('WORLD CREATED:', this.world);
  }
}
