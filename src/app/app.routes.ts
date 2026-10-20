import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Overview } from './home/overview/overview';
import { People } from './home/people/people';
import { Search } from './home/search/search';
import { Inventory } from './home/inventory/inventory';
import { AddCar } from './home/inventory/add-car/add-car';
import { Financing } from './home/inventory/financing/financing';
import { Recommended } from './home/inventory/recommended/recommended';

export const routes: Routes = [
  { path: '', redirectTo: 'home/overview', pathMatch: 'full' },

  {
    path: 'home',
    component: Home,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: Overview },
      { path: 'people', component: People },
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
  {path:'people', component:People},
  { path: '**', redirectTo: 'home/overview' },
];