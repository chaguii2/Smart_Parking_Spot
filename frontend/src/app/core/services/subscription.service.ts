import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiUrl = 'http://localhost:5000/api/subscriptions';

  constructor(private http: HttpClient) {}

  // Get subscription plans for a specific parking (public/client/company)
  public getPlansForParking(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/plans/parking/${parkingId}`);
  }

  // Create a new subscription plan (company)
  public createPlan(plan: {
    name: string;
    description?: string;
    parkingId: string;
    price: number;
    durationDays: number;
    features?: string[];
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/plans`, plan);
  }

  // Update a plan (company)
  public updatePlan(planId: string, updates: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/plans/${planId}`, updates);
  }

  // Get active subscribers for the logged-in company (company)
  public getCompanySubscribers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/company/subscribers`);
  }

  // Buy a subscription (client)
  public buySubscription(planId: string, paymentMethod: string = 'card'): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/buy`, { planId, paymentMethod });
  }

  // Get active and past subscriptions of the logged-in client (client)
  public getMySubscriptions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/client/my`);
  }

  // Get all subscriptions (super admin)
  public getAllSubscriptions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/all`);
  }
}
