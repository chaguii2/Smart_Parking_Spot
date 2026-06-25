import { Component, OnInit } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { ParkingService } from '../../core/services/parking.service';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-employee',
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css']
})
export class EmployeeComponent implements OnInit {
  activeSection: 'dashboard' | 'spots' | 'reservations' | 'scanner' | 'profile' = 'dashboard';
  
  // State variables
  profile: any = null;
  parking: any = null;
  spots: any[] = [];
  reservations: any[] = [];
  stats: any = {
    total: 0,
    available: 0,
    occupied: 0,
    maintenance: 0,
    reserved: 0
  };

  // Profile update form
  profileName = '';
  profilePhone = '';

  // QR scanning state
  searchQrCode = '';
  scannedReservation: any = null;

  // Selected spot for editing status
  selectedSpot: any = null;
  selectedSpotNewStatus = '';

  // UI state
  isLoading = false;
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';

  constructor(
    private userService: UserService,
    private parkingService: ParkingService,
    private reservationService: ReservationService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadInitialData(): void {
    this.isLoading = true;
    this.userService.getMe().subscribe({
      next: (res) => {
        this.profile = res.user;
        this.profileName = this.profile.name;
        this.profilePhone = this.profile.phone || '';

        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
          this.loadReservations(this.profile.parkingId);
        } else {
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement du profil.', 'error');
      }
    });
  }

  loadParkingAndSpots(parkingId: string): void {
    this.parkingService.getParkingLocationById(parkingId).subscribe({
      next: (res) => {
        this.parking = res.data;
      }
    });

    this.parkingService.getSpotsByParking(parkingId).subscribe({
      next: (res) => {
        this.spots = res.data || [];
        this.calculateSpotStats();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des places.', 'error');
      }
    });
  }

  loadReservations(parkingId: string): void {
    this.reservationService.getParkingReservations(parkingId).subscribe({
      next: (res) => {
        this.reservations = res.data || [];
      }
    });
  }

  calculateSpotStats(): void {
    const total = this.spots.length;
    const available = this.spots.filter(s => s.status === 'available').length;
    const occupied = this.spots.filter(s => s.status === 'occupied').length;
    const maintenance = this.spots.filter(s => s.status === 'maintenance').length;
    const reserved = this.spots.filter(s => s.status === 'reserved').length;

    this.stats = { total, available, occupied, maintenance, reserved };
  }

  selectSpot(spot: any): void {
    this.selectedSpot = spot;
    this.selectedSpotNewStatus = spot.status;
  }

  onUpdateSpotStatus(): void {
    if (!this.selectedSpot) return;

    this.isLoading = true;
    this.parkingService.updateSpotStatus(this.selectedSpot._id, this.selectedSpotNewStatus).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast(`Statut de la place ${this.selectedSpot.spotNumber} mis à jour avec succès.`);
        this.selectedSpot = null;
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de la mise à jour du statut.', 'error');
      }
    });
  }

  onSearchQr(event?: Event): void {
    if (event) event.preventDefault();
    if (!this.searchQrCode.trim()) {
      this.showToast('Veuillez saisir un code QR', 'error');
      return;
    }

    this.isLoading = true;
    this.scannedReservation = null;
    this.reservationService.verifyByQrCode(this.searchQrCode.trim()).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.scannedReservation = res.data;
        if (!this.scannedReservation) {
          this.showToast('Réservation introuvable pour ce QR code.', 'error');
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Code QR invalide ou réservation introuvable.', 'error');
      }
    });
  }

  onCheckIn(resId: string): void {
    this.isLoading = true;
    this.reservationService.checkIn(resId, this.searchQrCode).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Check-in effectué ! Le véhicule est garé.');
        if (this.scannedReservation && this.scannedReservation._id === resId) {
          this.scannedReservation = res.data;
        }
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
          this.loadReservations(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors du check-in.', 'error');
      }
    });
  }

  onCheckOut(resId: string): void {
    this.isLoading = true;
    this.reservationService.checkOut(resId).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Check-out effectué ! La place est maintenant libre.');
        if (this.scannedReservation && this.scannedReservation._id === resId) {
          this.scannedReservation = res.data;
        }
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
          this.loadReservations(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors du check-out.', 'error');
      }
    });
  }

  onMarkNoShow(resId: string): void {
    if (!confirm('Voulez-vous marquer cette réservation comme non présentée (No Show) ?')) return;

    this.isLoading = true;
    this.reservationService.markNoShow(resId).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Réservation marquée comme No Show.');
        if (this.scannedReservation && this.scannedReservation._id === resId) {
          this.scannedReservation = res.data;
        }
        if (this.profile.parkingId) {
          this.loadParkingAndSpots(this.profile.parkingId);
          this.loadReservations(this.profile.parkingId);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur.', 'error');
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
        this.showToast('Profil mis à jour avec succès.');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de la mise à jour.', 'error');
      }
    });
  }
}
