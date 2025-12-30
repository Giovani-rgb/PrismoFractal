import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameMenu } from './game-menu';

describe('GameMenu', () => {
  let component: GameMenu;
  let fixture: ComponentFixture<GameMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameMenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
