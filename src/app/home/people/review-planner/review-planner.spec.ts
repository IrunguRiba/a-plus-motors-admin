import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewPlanner } from './review-planner';

describe('ReviewPlanner', () => {
  let component: ReviewPlanner;
  let fixture: ComponentFixture<ReviewPlanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewPlanner],
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewPlanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
