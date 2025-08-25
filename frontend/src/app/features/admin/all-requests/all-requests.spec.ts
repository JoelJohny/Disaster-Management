import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllRequests } from './all-requests';

describe('AllRequests', () => {
  let component: AllRequests;
  let fixture: ComponentFixture<AllRequests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllRequests]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllRequests);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
