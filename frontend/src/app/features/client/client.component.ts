import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css']
})
export class ClientComponent implements OnInit {
  activeSection: 'parkings' | 'subscriptions' = 'parkings';
  parkings: any[] = [];
  selectedParking: any = null;
  plans: any[] = [];
  mySubscriptions: any[] = [];
  
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;

  constructor(
    private http: HttpClient,
    private subscriptionService: SubscriptionService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadParkings();
    this.loadMySubscriptions();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadParkings(): void {
    this.isLoading = true;
    this.http.get<any>('http://localhost:5000/api/parking/map/parkings').subscribe({
      next: (res) => {
        this.isLoading = false;
        this.parkings = res.data || [];
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des parkings.', 'error');
      }
    });
  }

  loadMySubscriptions(): void {
    this.subscriptionService.getMySubscriptions().subscribe({
      next: (res) => {
        this.mySubscriptions = res.subscriptions || [];
      },
      error: () => {
        this.showToast('Erreur lors du chargement de vos abonnements.', 'error');
      }
    });
  }

  selectParking(parking: any): void {
    this.selectedParking = parking;
    this.plans = [];
    this.isLoading = true;
    this.subscriptionService.getPlansForParking(parking.id || parking._id).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.plans = res.plans || [];
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des forfaits.', 'error');
      }
    });
  }

  buySubscription(plan: any): void {
    if (!confirm(`Confirmer l'achat de l'abonnement "${plan.name}" pour ${plan.price}€ ?`)) {
      return;
    }

    this.isLoading = true;
    this.subscriptionService.buySubscription(plan._id, 'card').subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Félicitations ! Votre abonnement a été activé avec succès.');
        this.loadMySubscriptions();
        // Close selection modal
        this.selectedParking = null;
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de la transaction.', 'error');
      }
    });
  }
}
