import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvailableRequests } from './available-requests';

describe('AvailableRequests', () => {
  let component: AvailableRequests;
  let fixture: ComponentFixture<AvailableRequests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvailableRequests]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvailableRequests);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
