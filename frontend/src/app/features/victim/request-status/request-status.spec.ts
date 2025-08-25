import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestStatus } from './request-status';

describe('RequestStatus', () => {
  let component: RequestStatus;
  let fixture: ComponentFixture<RequestStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestStatus]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestStatus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
