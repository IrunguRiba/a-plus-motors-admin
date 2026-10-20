import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContentSeo } from './content-seo';

describe('ContentSeo', () => {
  let component: ContentSeo;
  let fixture: ComponentFixture<ContentSeo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContentSeo],
    }).compileComponents();

    fixture = TestBed.createComponent(ContentSeo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
