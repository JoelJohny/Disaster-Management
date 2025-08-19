import { Routes } from '@angular/router';
import { Dashboard } from './layout/dashboard/dashboard';

// export const routes: Routes = [];
export const routes: Routes = [
  { path: '', component: Dashboard },
//   { path: 'users', loadChildren: () => import('./pages/users/users.module').then(m => m.UsersModule) },
//   { path: 'reports', loadChildren: () => import('./pages/reports/reports.module').then(m => m.ReportsModule) },
];
