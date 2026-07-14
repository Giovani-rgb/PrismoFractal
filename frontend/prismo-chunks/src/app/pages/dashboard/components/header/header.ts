import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';

@Component({
  selector: 'app-arcade-header',
  imports: [CommonModule, SlicePipe],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ArcadeHeader {
  @Input() username: string = '';
  @Input() uid: string = '';
  @Output() onLogout = new EventEmitter<void>();

  triggerLogout() {
    this.onLogout.emit();
  }
}
