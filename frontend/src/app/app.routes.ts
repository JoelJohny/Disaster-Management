import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canMatch: [guestGuard],
    loadComponent: () => import('./layout/auth-layout/auth-layout').then(m => m.AuthLayout),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
      { path: 'register', loadComponent: () => import('./pages/registration/registration').then(m => m.Registration) },
    ],
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then(m => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home-redirect/home-redirect').then(m => m.HomeRedirect) },

      // Common
      { path: 'profile', loadComponent: () => import('./pages/user-profile/user-profile').then(m => m.UserProfile) },
      { path: 'requests/:id', loadComponent: () => import('./features/request-detail/request-detail').then(m => m.RequestDetail) },

      // Victim
      {
        path: 'victim', canMatch: [roleGuard('VICTIM', 'ADMIN')],
        children: [
          { path: 'dashboard', loadComponent: () => import('./features/dashboard/victim-dashboard/victim-dashboard').then(m => m.VictimDashboard) },
          { path: 'submit-request', loadComponent: () => import('./features/victim/request/request').then(m => m.SubmitRequest) },
          { path: 'my-requests', loadComponent: () => import('./features/victim/request-status/request-status').then(m => m.RequestStatus) },
          { path: 'feedback/:requestId', loadComponent: () => import('./features/victim/feedback/feedback').then(m => m.Feedback) },
        ],
      },

      // Volunteer
      {
        path: 'volunteer', canMatch: [roleGuard('VOLUNTEER', 'ADMIN')],
        children: [
          { path: 'dashboard', loadComponent: () => import('./features/volunteer/volunteer-dashboard/volunteer-dashboard').then(m => m.VolunteerDashboard) },
          { path: 'available-tasks', loadComponent: () => import('./features/volunteer/available-requests/available-requests').then(m => m.AvailableRequests) },
          { path: 'my-tasks', loadComponent: () => import('./features/volunteer/assigned-tasks/assigned-tasks').then(m => m.AssignedTasks) },
        ],
      },

      // Admin
      {
        path: 'dashboard', canMatch: [roleGuard('ADMIN')],
        loadComponent: () => import('./layout/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'admin', canMatch: [roleGuard('ADMIN')],
        children: [
          { path: 'user-management', loadComponent: () => import('./features/admin/user-management/user-management').then(m => m.UserManagement) },
          { path: 'all-requests', loadComponent: () => import('./features/admin/all-requests/all-requests').then(m => m.AllRequests) },
          { path: 'disaster-management', loadComponent: () => import('./features/admin/disaster-management/disaster-management').then(m => m.DisasterManagement) },
          { path: 'system-reports', loadComponent: () => import('./features/admin/system-reports/system-reports').then(m => m.SystemReports) },
        ],
      },

      { path: 'forbidden', loadComponent: () => import('./pages/forbidden/forbidden').then(m => m.Forbidden) },
    ],
  },
  { path: '**', loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound) },
];
