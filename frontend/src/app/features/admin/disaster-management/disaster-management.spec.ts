import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisasterManagement } from './disaster-management';

describe('DisasterManagement', () => {
  let component: DisasterManagement;
  let fixture: ComponentFixture<DisasterManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisasterManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisasterManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
