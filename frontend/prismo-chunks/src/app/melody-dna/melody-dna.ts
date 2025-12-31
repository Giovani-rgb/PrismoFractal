import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-melody-dna',
  imports: [CommonModule, FormsModule],
  templateUrl: './melody-dna.html',
  styleUrl: './melody-dna.scss',
})
export class MelodyDna {
 step = 1;

  dna = {
    ideology: '',
    hasTimeSignature: false,
    timeSignature: '',
    style: '',
    rootNote: '',
    weakNotes: [] as string[],
    syncopation: ''
  };

  toggleWeakNote(note: string) {
    const idx = this.dna.weakNotes.indexOf(note);
    idx >= 0
      ? this.dna.weakNotes.splice(idx, 1)
      : this.dna.weakNotes.push(note);
  }

  next() {
    if (this.step < 5) this.step++;
  }

  back() {
    if (this.step > 1) this.step--;
  }

  finish() {
    console.log('Melody DNA:', this.dna);
  }
}

