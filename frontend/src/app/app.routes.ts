import { Routes } from '@angular/router';
import { Dashboard } from './layout/dashboard/dashboard';
import { MainLayout } from './layout/main-layout/main-layout';
import { Login } from './pages/login/login';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { Registration } from './pages/registration/registration';
import { VictimDashboard } from './features/dashboard/victim-dashboard/victim-dashboard';
import { Request } from './features/victim/request/request';
import { RequestStatus } from './features/victim/request-status/request-status';
import { Feedback } from './features/victim/feedback/feedback';
import { VolunteerDashboard } from './features/volunteer/volunteer-dashboard/volunteer-dashboard';
import { AvailableRequests } from './features/volunteer/available-requests/available-requests';
import { AssignedTasks } from './features/volunteer/assigned-tasks/assigned-tasks';
import { UserManagement } from './features/admin/user-management/user-management';
import { AllRequests } from './features/admin/all-requests/all-requests';
import { DisasterManagement } from './features/admin/disaster-management/disaster-management';
import { SystemReports } from './features/admin/system-reports/system-reports';
import { UserProfile } from './pages/user-profile/user-profile';

export const routes: Routes = [
  {
    path: '',
    component: AuthLayout,
    children: [
      { path: 'login', component: Login },
      { path: 'register', component: Registration },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      // Common Routes
      { path: 'profile', component: UserProfile },
      { path: 'dashboard', component: Dashboard }, // Generic or Admin Dashboard

      // Victim Routes
      { path: 'victim/dashboard', component: VictimDashboard },
      { path: 'victim/submit-request', component: Request },
      { path: 'victim/my-requests', component: RequestStatus },
      { path: 'victim/feedback', component: Feedback },
      
      // Volunteer Routes
      { path: 'volunteer/dashboard', component: VolunteerDashboard },
      { path: 'volunteer/available-tasks', component: AvailableRequests },
      { path: 'volunteer/my-tasks', component: AssignedTasks },
      
      // Admin Routes
      { path: 'admin/user-management', component: UserManagement },
      { path: 'admin/all-requests', component: AllRequests },
      { path: 'admin/disaster-management', component: DisasterManagement },
      { path: 'admin/system-reports', component: SystemReports },

      // Default redirect
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: 'login' } // Redirect any unknown paths to login
];
