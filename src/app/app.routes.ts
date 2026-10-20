import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Overview } from './home/overview/overview';
import { People } from './home/people/people';
import { Search } from './home/search/search';
import { Inventory } from './home/inventory/inventory';
import { AddCar } from './home/inventory/add-car/add-car';
import { Financing } from './home/inventory/financing/financing';
import { Recommended } from './home/inventory/recommended/recommended';
import { SocialHub } from './home/people/social-hub/social-hub';
import { ReviewPlanner } from './home/people/review-planner/review-planner';
import { ContentSeo } from './home/people/content-seo/content-seo';
import { Customers } from './home/people/customers/customers';

export const routes: Routes = [
  { path: '', redirectTo: 'home/overview', pathMatch: 'full' },

  {
    path: 'home',
    component: Home,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: Overview },
      { 
        path: 'people', 
        component: People,
        children: [
          { path: '', redirectTo: 'social-hub', pathMatch: 'full' },
          { path: 'social-hub', component: SocialHub },
          { path: 'review-planner', component: ReviewPlanner },
          { path: 'content-seo', component: ContentSeo },
          { path: 'customers', component: Customers }
        ]
      },
      { path: 'search', component: Search },
      {
        path: 'inventory',
        component: Inventory,
        children: [
          { path: '', redirectTo: 'add-car', pathMatch: 'full' },
          { path: 'add-car', component: AddCar },
          { path: 'recommended', component: Recommended },
          { path: 'financing', component: Financing },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'home/overview' },
];