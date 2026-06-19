import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

export interface AuthResponse {
  token: string;
  user: any; // adjust as needed
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUser: any = null;

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Login and store token + user data.
   */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res: AuthResponse) => this.storeAuthData(res.token, res.user))
    );
  }

  /**
   * Register and store token + user data.
   */
  register(data: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap((res: AuthResponse) => this.storeAuthData(res.token, res.user))
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    this.currentUser = null;
    this.router.navigate(['/login']);
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /** Returns true if a JWT token exists. */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /** Getter for template use. */
  get currentUserValue(): any {
    return this.currentUser;
  }

  /** Returns the role of the current user, if available. */
  getRole(): string | null {
    return this.currentUser?.role || null;
  }

  /** Store token and user after authentication. */
  private storeAuthData(token: string, user: any): void {
    this.setToken(token);
    this.currentUser = user;
  }

  // Backward compatibility
  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }
}
