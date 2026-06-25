import { Component, OnInit } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { ReservationService } from '../../core/services/reservation.service';

@Component({
  selector: 'app-company',
  templateUrl: './company.component.html',
  styleUrls: ['./company.component.css']
})
export class CompanyComponent implements OnInit {
  activeSection: 'parking' | 'employees' | 'profile' | 'subscriptions' | 'reservations' = 'parking';
  profile: any = null;
  employees: any[] = [];
  parkings: any[] = [];
  subscribers: any[] = [];
  plans: Record<string, any[]> = {}; // Map of parkingId -> plans[]
  parkingReservations: Record<string, any[]> = {}; // Map of parkingId -> reservations[]
  parkingStats: Record<string, any> = {}; // Map of parkingId -> stats object

  // Parking request form
  parkingName = '';
  parkingAddress = '';
  parkingCity = '';
  parkingZip = '';
  parkingSpots: number | null = null;
  parkingPrice: number | null = null;
  parkingSubmitted = false;

  // Employee form
  empName = '';
  empEmail = '';
  empPassword = '';
  empPhone = '';
  empParkingId = '';
  empPosition = 'agent';

  // Subscription Plan form
  planName = '';
  planDescription = '';
  planParkingId = '';
  planPrice: number | null = null;
  planDurationDays: number | null = null;
  planFeaturesInput = '';

  // Profile fields (inputs bound directly to template inputs)
  profileAddress = '';
  profileSiret = '';

  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;

  constructor(
    private userService: UserService, 
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private reservationService: ReservationService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadEmployees();
    this.loadParkings();
    this.loadSubscribers();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadProfile(): void {
    this.userService.getMe().subscribe({ 
      next: r => {
        this.profile = r.user;
        this.profileAddress = this.profile.address || '';
        this.profileSiret = this.profile.siret || '';
      }
    });
  }

  loadEmployees(): void {
    this.userService.getEmployees().subscribe({ next: r => this.employees = r.employees || [] });
  }

  loadSubscribers(): void {
    this.subscriptionService.getCompanySubscribers().subscribe({
      next: r => this.subscribers = r.subscriptions || r.subscribers || []
    });
  }

  loadParkings(): void {
    this.userService.getCompanyParkings().subscribe({
      next: r => {
        this.parkings = r.parkings || [];
        // Load plans, reservations, and stats for each approved parking
        this.parkings.forEach(p => {
          if (p.status === 'approved') {
            this.loadPlansForParking(p._id);
            this.loadReservationsForParking(p._id);
            this.loadStatsForParking(p._id);
          }
        });
      }
    });
  }

  loadPlansForParking(parkingId: string): void {
    this.subscriptionService.getPlansForParking(parkingId).subscribe({
      next: r => {
        this.plans[parkingId] = r.plans || [];
      }
    });
  }

  loadReservationsForParking(parkingId: string): void {
    this.reservationService.getParkingReservations(parkingId).subscribe({
      next: r => {
        this.parkingReservations[parkingId] = r.data || [];
      }
    });
  }

  loadStatsForParking(parkingId: string): void {
    this.reservationService.getParkingStats(parkingId).subscribe({
      next: r => {
        this.parkingStats[parkingId] = r.data || null;
      }
    });
  }

  onSubmitParking(event: Event): void {
    event.preventDefault();
    if (!this.parkingName || !this.parkingAddress || !this.parkingCity || !this.parkingZip || !this.parkingSpots || this.parkingPrice === null) {
      this.showToast('Veuillez remplir tous les champs du parking', 'error');
      return;
    }
    this.isLoading = true;
    this.userService.submitParkingRequest({
      name: this.parkingName,
      address: this.parkingAddress,
      city: this.parkingCity,
      zipCode: this.parkingZip,
      totalSpots: this.parkingSpots,
      pricePerHour: this.parkingPrice
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.parkingSubmitted = true;
        this.showToast('Demande de parking envoyée ! L\'administrateur a été notifié.');
        this.parkingName = this.parkingAddress = this.parkingCity = this.parkingZip = '';
        this.parkingSpots = this.parkingPrice = null;
        this.loadParkings();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la soumission', 'error');
      }
    });
  }

  onCreateEmployee(event: Event): void {
    event.preventDefault();
    if (!this.empName || !this.empEmail || !this.empPassword || !this.empPhone || !this.empParkingId) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }
    this.isLoading = true;
    this.userService.createEmployee({
      name: this.empName,
      email: this.empEmail,
      password: this.empPassword,
      phone: this.empPhone,
      parkingId: this.empParkingId,
      position: this.empPosition
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Employé créé ! Un email avec ses identifiants lui a été envoyé.');
        this.empName = this.empEmail = this.empPassword = this.empPhone = this.empParkingId = '';
        this.loadEmployees();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  onCreatePlan(event: Event): void {
    event.preventDefault();
    if (!this.planName || !this.planParkingId || this.planPrice === null || !this.planDurationDays) {
      this.showToast('Veuillez remplir les champs obligatoires du forfait', 'error');
      return;
    }

    const features = this.planFeaturesInput
      ? this.planFeaturesInput.split(',').map(f => f.trim()).filter(f => f.length > 0)
      : [];

    this.isLoading = true;
    this.subscriptionService.createPlan({
      name: this.planName,
      description: this.planDescription,
      parkingId: this.planParkingId,
      price: this.planPrice,
      durationDays: this.planDurationDays,
      features
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Plan d\'abonnement créé avec succès !');
        this.planName = this.planDescription = this.planParkingId = this.planFeaturesInput = '';
        this.planPrice = this.planDurationDays = null;
        this.loadParkings(); // Reload to refresh plans list
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la création du plan', 'error');
      }
    });
  }

  togglePlanStatus(planId: string, currentStatus: boolean, parkingId: string): void {
    this.subscriptionService.updatePlan(planId, { isActive: !currentStatus }).subscribe({
      next: () => {
        this.showToast('Statut du plan d\'abonnement mis à jour.');
        this.loadPlansForParking(parkingId);
      },
      error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
    });
  }

  onUpdateProfile(event: Event): void {
    event.preventDefault();
    const payload = {
      name: this.profile.name,
      phone: this.profile.phone,
      address: this.profileAddress,
      siret: this.profileSiret
    };
    this.userService.updateMe(payload).subscribe({
      next: (r) => {
        this.profile = r.user;
        this.authService.updateCurrentUserValue({ name: r.user.name });
        this.showToast('Profil mis à jour.');
      },
      error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
    });
  }

  getApprovedParkings() {
    return this.parkings.filter(p => p.status === 'approved');
  }
}
