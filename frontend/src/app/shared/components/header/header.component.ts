import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  constructor(public authService: AuthService, private router: Router) {}

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }

  getRoleBadge(): string {
    const role = this.authService.getRole();
    const map: Record<string, string> = {
      super_admin: 'Administrateur',
      company: 'Entreprise',
      employee: 'Employé',
      client: 'Client'
    };
    return map[role || ''] || role || '';
  }
}
