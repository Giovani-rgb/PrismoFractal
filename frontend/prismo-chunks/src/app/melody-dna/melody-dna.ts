import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Ideology = {
  id: string;
  label: string;
  description: string;
};

type NoteBlock = {
  note: string;
  length: 'long' | 'medium' | 'short';
};

@Component({
  selector: 'app-melody-dna',
  imports: [CommonModule, FormsModule],
  templateUrl: './melody-dna.html',
  styleUrl: './melody-dna.scss',
})
export class MelodyDna {

 step = 1;

  /* ==========================
     DNA STATE
  ========================== */
  dna = {
    ideology: '',
    style: '',
    rootNote: 'C',
    syncopation: ''
  };

  /* ==========================
     STEP 1 — IDEOLOGY CAROUSEL
  ========================== */
  ideologies: Ideology[] = [
    {
      id: 'simple',
      label: 'Simple',
      description: 'Straight, repetitive and stable patterns.'
    },
    {
      id: 'hybrid',
      label: 'Hybrid',
      description: 'Mix of repetition and variation.'
    },
    {
      id: 'triplet',
      label: 'Triplet',
      description: 'Ternary groove with swing and syncopation.'
    }
  ];

  ideologyIndex = 0;

  selectIdeology() {
    this.dna.ideology = this.ideologies[this.ideologyIndex].id;
  }

  prevIdeology() {
    if (this.ideologyIndex > 0) this.ideologyIndex--;
  }

  nextIdeology() {
    if (this.ideologyIndex < this.ideologies.length - 1)
      this.ideologyIndex++;
  }

  /* ==========================
     STEP 4 — CHORD FRAME
  ========================== */
  type NoteLength = 'short' | 'medium' | 'long';

  type RhythmNote = {
    length: NoteLength;
  };

  chord: RhythmNote[] = [
    { length: 'long' } // root
  ];

  selectedNoteIndex = 0;

  addNote() {
    this.chord.push({ length: 'short' });
    this.selectedNoteIndex = this.chord.length - 1;
  }

  removeNote() {
    if (this.selectedNoteIndex === 0) return;
    this.chord.splice(this.selectedNoteIndex, 1);
    this.selectedNoteIndex = 0;
  }

  setLength(length: NoteLength) {
    this.chord[this.selectedNoteIndex].length = length;
  }
@ViewChild('chordCanvas', { static: false })
canvas!: ElementRef<HTMLCanvasElement>;

ngAfterViewInit() {
  this.drawChord();
}

drawChord() {
  const ctx = this.canvas.nativeElement.getContext('2d')!;
  ctx.clearRect(0, 0, 600, 80);

  let x = 10;

  this.chord.forEach((note, index) => {
    const width =
      note.length === 'long' ? 160 :
      note.length === 'medium' ? 100 : 60;

    ctx.fillStyle = index === this.selectedNoteIndex ? '#0ff' : '#555';
    ctx.fillRect(x, 20, width, 40);

    x += width + 10;
  });
}

  /* ==========================
     NAVIGATION
  ========================== */
  next() {
    if (this.step === 1) this.selectIdeology();
    if (this.step < 5) this.step++;
  }

  back() {
    if (this.step > 1) this.step--;
  }

  finish() {
    console.log('DNA RESULT:', {
      ...this.dna,
      chord: this.chord
    });
  }
}





