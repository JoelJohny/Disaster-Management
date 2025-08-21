import { Routes } from '@angular/router';
import { Dashboard } from './layout/dashboard/dashboard';
import { MainLayout } from './layout/main-layout/main-layout';
import { Login } from './pages/login/login';
import { AuthLayout } from './layout/auth-layout/auth-layout';

// export const routes: Routes = [];
export const routes: Routes = [
{
    path: '',
    component: MainLayout,
    children: [
      { path: '', component: Dashboard },
    //   { path: 'users', loadChildren: () => import('./pages/users/users.module').then(m => m.UsersModule) },
    //   { path: 'reports', loadChildren: () => import('./pages/reports/reports.module').then(m => m.ReportsModule) },
    ]
  },
  {
    path: '',
    component: AuthLayout,
    children: [
      { path: 'login', component: Login },
    ]
  },
  { path: '**', redirectTo: '' }
];
