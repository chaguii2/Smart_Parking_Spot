import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../core/services/admin.service';
import { ParkingService } from '../../core/services/parking.service';
import { ReservationService } from '../../core/services/reservation.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  companies: any[] = [];
  parkings: any[] = [];
  allSubscriptions: any[] = [];
  allReservations: any[] = [];
  profile: any = null;

  activeSection: 'companies' | 'parkings' | 'simulation' | 'subscriptions' | 'reservations' | 'profile' = 'companies';
  
  // Profile inputs
  profileName = '';
  profilePhone = '';

  // Rejection modal helper state
  rejectReason = '';
  rejectTargetId: string | null = null;
  rejectType: 'company' | 'parking' = 'company';

  // UI State
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;

  constructor(
    private adminService: AdminService,
    private parkingService: ParkingService,
    private reservationService: ReservationService,
    private subscriptionService: SubscriptionService,
    private userService: UserService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadCompanies();
    this.loadParkings();
    this.loadAllSubscriptions();
    this.loadAllReservations();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadProfile(): void {
    this.userService.getMe().subscribe({
      next: (res) => {
        this.profile = res.user;
        this.profileName = this.profile.name || '';
        this.profilePhone = this.profile.phone || '';
      }
    });
  }

  loadCompanies(): void {
    this.adminService.getCompanies().subscribe({ 
      next: r => this.companies = r.companies || [], 
      error: () => this.showToast('Erreur chargement entreprises', 'error') 
    });
  }

  loadParkings(): void {
    this.adminService.getParkings().subscribe({ 
      next: r => this.parkings = r.parkings || [], 
      error: () => this.showToast('Erreur chargement parkings', 'error') 
    });
  }

  loadAllSubscriptions(): void {
    this.subscriptionService.getAllSubscriptions().subscribe({
      next: r => this.allSubscriptions = r.subscriptions || []
    });
  }

  loadAllReservations(): void {
    this.reservationService.getAllReservations().subscribe({
      next: r => this.allReservations = r.data || []
    });
  }

  approveCompany(id: string): void {
    this.adminService.approveCompany(id).subscribe({ 
      next: () => { this.showToast('Entreprise approuvée'); this.loadCompanies(); }, 
      error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
    });
  }

  suspendCompany(id: string): void {
    this.adminService.suspendCompany(id).subscribe({ 
      next: () => { this.showToast('Entreprise suspendue'); this.loadCompanies(); }, 
      error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
    });
  }

  openRejectModal(id: string, type: 'company' | 'parking'): void {
    this.rejectTargetId = id;
    this.rejectType = type;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.rejectTargetId) return;
    if (this.rejectType === 'company') {
      this.adminService.rejectCompany(this.rejectTargetId, this.rejectReason).subscribe({ 
        next: () => { this.showToast('Entreprise rejetée'); this.loadCompanies(); this.rejectTargetId = null; }, 
        error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
      });
    } else {
      this.adminService.rejectParking(this.rejectTargetId, this.rejectReason).subscribe({ 
        next: () => { this.showToast('Parking rejeté'); this.loadParkings(); this.rejectTargetId = null; }, 
        error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
      });
    }
  }

  approveParking(id: string): void {
    this.adminService.approveParking(id).subscribe({ 
      next: () => { this.showToast('Parking approuvé'); this.loadParkings(); }, 
      error: e => this.showToast(e.error?.message || 'Erreur', 'error') 
    });
  }

  // Simulation controls
  generateSpots(parkingId: string): void {
    this.isLoading = true;
    this.parkingService.generateSpots(parkingId).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Places de parking générées avec succès !');
        this.loadParkings();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la génération.', 'error');
      }
    });
  }

  startSimulation(parkingId: string): void {
    this.isLoading = true;
    this.parkingService.startSimulation(parkingId).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Simulation temps réel démarrée !');
        this.loadParkings();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors du démarrage.', 'error');
      }
    });
  }

  stopSimulation(parkingId: string): void {
    this.isLoading = true;
    this.parkingService.stopSimulation(parkingId).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Simulation arrêtée.');
        this.loadParkings();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de l\'arrêt.', 'error');
      }
    });
  }

  onUpdateProfile(event: Event): void {
    event.preventDefault();
    if (!this.profileName.trim()) {
      this.showToast('Le nom est obligatoire.', 'error');
      return;
    }

    this.isLoading = true;
    this.userService.updateMe({ name: this.profileName, phone: this.profilePhone }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.profile = res.user;
        this.authService.updateCurrentUserValue({ name: res.user.name });
        this.showToast('Profil admin mis à jour avec succès.');
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la mise à jour.', 'error');
      }
    });
  }

  getApprovedParkings() {
    return this.parkings.filter(p => p.status === 'approved');
  }
}
