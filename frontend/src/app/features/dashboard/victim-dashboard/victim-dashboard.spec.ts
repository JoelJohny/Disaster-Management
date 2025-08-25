import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VictimDashboard } from './victim-dashboard';

describe('VictimDashboard', () => {
  let component: VictimDashboard;
  let fixture: ComponentFixture<VictimDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VictimDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VictimDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
