import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthComponent } from './features/auth/auth.component';
import { AdminComponent } from './features/admin/admin.component';
import { CompanyComponent } from './features/company/company.component';
import { ClientComponent } from './features/client/client.component';
import { AuthGuard } from './core/auth/auth.guard';

const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { 
    path: 'admin', 
    component: AdminComponent, 
    canActivate: [AuthGuard], 
    data: { roles: ['super_admin'] } 
  },
  { 
    path: 'company', 
    component: CompanyComponent, 
    canActivate: [AuthGuard], 
    data: { roles: ['company'] } 
  },
  { 
    path: 'client', 
    component: ClientComponent, 
    canActivate: [AuthGuard], 
    data: { roles: ['client'] } 
  },
  { path: '', redirectTo: '/auth', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
