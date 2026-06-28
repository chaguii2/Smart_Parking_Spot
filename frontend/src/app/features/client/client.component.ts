import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AuthService } from '../../core/services/auth.service';
import { ReservationService } from '../../core/services/reservation.service';
import { ParkingService } from '../../core/services/parking.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css']
})
export class ClientComponent implements OnInit {
  activeSection: 'parkings' | 'subscriptions' | 'reservations' | 'profile' = 'parkings';
  
  // Data lists
  parkings: any[] = [];
  selectedParking: any = null;
  plans: any[] = [];
  mySubscriptions: any[] = [];
  myReservations: any[] = [];

  // Profile data
  profile: any = null;
  profileName = '';
  profilePhone = '';
  profileCin = '';
  profilePlate = '';
  profileSerial = '';
  profileVehicleType = 'car';
  profilePaymentMethod = 'card';
  profileEmailNotifications = true;
  profileSmsNotifications = false;

  // Booking details
  selectedParkingForBooking: any = null;
  bookingSpots: any[] = [];
  bookingSpotId = '';
  bookingVehiclePlate = '';
  bookingVehicleType = 'car';
  bookingStartTime = '';
  bookingEndTime = '';
  bookingPaymentMethod = 'card';
  bookingNotes = '';

  // Review modal state
  selectedResForReview: any = null;
  reviewRating = 5;
  reviewComment = '';

  // UI state
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;

  constructor(
    private http: HttpClient,
    private subscriptionService: SubscriptionService,
    private reservationService: ReservationService,
    private parkingService: ParkingService,
    private userService: UserService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadParkings();
    this.loadMySubscriptions();
    this.loadMyReservations();
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
        this.profileCin = this.profile.cin || '';
        this.profilePlate = this.profile.vehiclePlate || '';
        this.profileSerial = this.profile.vehicleSerialNumber || '';
        this.profileVehicleType = this.profile.vehicleType || 'car';
        this.profilePaymentMethod = this.profile.preferredPaymentMethod || 'card';
        this.profileEmailNotifications = this.profile.emailNotifications !== false;
        this.profileSmsNotifications = this.profile.smsNotifications === true;
      }
    });
  }

  loadParkings(): void {
    this.isLoading = true;
    this.parkingService.getParkingLocations().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.parkings = res.data || [];
      },
      error: () => {
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

  loadMyReservations(): void {
    this.reservationService.getMyReservations().subscribe({
      next: (res) => {
        this.myReservations = res.data || [];
      },
      error: () => {
        this.showToast('Erreur lors du chargement de vos réservations.', 'error');
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
      next: () => {
        this.isLoading = false;
        this.showToast('Félicitations ! Votre abonnement a été activé avec succès.');
        this.loadMySubscriptions();
        this.selectedParking = null;
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de la transaction.', 'error');
      }
    });
  }

  // Reservation Flow
  startBooking(parking: any): void {
    this.selectedParkingForBooking = parking;
    this.bookingSpotId = '';
    this.bookingVehiclePlate = this.profile?.vehiclePlate || '';
    this.bookingVehicleType = this.profile?.vehicleType || 'car';
    this.bookingPaymentMethod = this.profile?.preferredPaymentMethod || 'card';
    this.bookingNotes = '';
    
    // Set default times (now and +2 hours)
    const now = new Date();
    const plusTwo = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    // Format to local ISO without offset timezone stuff (YYYY-MM-DDTHH:mm)
    this.bookingStartTime = this.formatDateTimeLocal(now);
    this.bookingEndTime = this.formatDateTimeLocal(plusTwo);

    this.isLoading = true;
    // Use the dedicated available-spots endpoint which correctly filters by isAvailable=true & isReserved=false
    this.parkingService.getAvailableSpots(parking._id || parking.id).subscribe({
      next: (res) => {
        this.isLoading = false;
        // Backend returns { success: true, data: [...spots...] }
        this.bookingSpots = res.data || res.spots || [];
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des places disponibles.', 'error');
      }
    });
  }

  formatDateTimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  onSubmitBooking(event: Event): void {
    event.preventDefault();
    if (!this.bookingVehiclePlate || !this.bookingStartTime || !this.bookingEndTime || !this.bookingSpotId) {
      this.showToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }

    const payload: any = {
      parkingId: this.selectedParkingForBooking._id || this.selectedParkingForBooking.id,
      vehiclePlate: this.bookingVehiclePlate,
      vehicleType: this.bookingVehicleType,
      startTime: new Date(this.bookingStartTime).toISOString(),
      endTime: new Date(this.bookingEndTime).toISOString(),
      paymentMethod: this.bookingPaymentMethod,
      notes: this.bookingNotes,
      ...(this.bookingSpotId ? { spotId: this.bookingSpotId } : {})
    };

    this.isLoading = true;
    this.reservationService.createReservation(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Réservation créée avec succès ! En attente de confirmation.');
        this.selectedParkingForBooking = null;
        this.loadMyReservations();
        this.activeSection = 'reservations';
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || err.error?.errors?.[0]?.msg || 'Erreur lors de la réservation.', 'error');
      }
    });
  }

  confirmReservation(id: string): void {
    this.isLoading = true;
    this.reservationService.confirmReservation(id).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Votre réservation a été confirmée avec succès.');
        this.loadMyReservations();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de la confirmation.', 'error');
      }
    });
  }

  cancelReservation(id: string): void {
    const reason = prompt('Veuillez saisir le motif de l\'annulation :');
    if (reason === null) return; // cancelled prompt

    this.isLoading = true;
    this.reservationService.cancelReservation(id, reason).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Votre réservation a été annulée.');
        this.loadMyReservations();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de l\'annulation.', 'error');
      }
    });
  }

  openReviewModal(res: any): void {
    this.selectedResForReview = res;
    this.reviewRating = 5;
    this.reviewComment = '';
  }

  onSubmitReview(): void {
    if (!this.selectedResForReview) return;

    this.isLoading = true;
    this.reservationService.leaveReview(this.selectedResForReview._id, this.reviewRating, this.reviewComment).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Merci pour votre avis !');
        this.selectedResForReview = null;
        this.loadMyReservations();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors du dépôt de l\'avis.', 'error');
      }
    });
  }

  // Profile Update
  onUpdateProfile(event: Event): void {
    event.preventDefault();
    if (!this.profileName.trim() || !this.profilePhone.trim()) {
      this.showToast('Le nom et le téléphone sont obligatoires.', 'error');
      return;
    }

    const updates = {
      name: this.profileName,
      phone: this.profilePhone,
      cin: this.profileCin,
      vehiclePlate: this.profilePlate,
      vehicleSerialNumber: this.profileSerial,
      vehicleType: this.profileVehicleType,
      preferredPaymentMethod: this.profilePaymentMethod,
      emailNotifications: this.profileEmailNotifications,
      smsNotifications: this.profileSmsNotifications
    };

    this.isLoading = true;
    this.userService.updateMe(updates).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.profile = res.user;
        this.authService.updateCurrentUserValue({ name: res.user.name });
        this.showToast('Votre profil a été mis à jour avec succès.');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || err.error?.errors?.[0]?.msg || 'Erreur lors de la mise à jour.', 'error');
      }
    });
  }
}
