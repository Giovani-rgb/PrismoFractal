import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MelodyDna } from './melody-dna';

describe('MelodyDna', () => {
  let component: MelodyDna;
  let fixture: ComponentFixture<MelodyDna>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MelodyDna]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MelodyDna);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
