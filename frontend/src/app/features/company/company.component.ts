import { Component, OnInit } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { ReservationService } from '../../core/services/reservation.service';
import { FaceAuthService } from '../../core/services/face-auth.service';

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
  empShiftStart = '08:00';
  empShiftEnd = '17:00';

  // Activity logs modal state
  selectedEmployeeForLogs: any = null;
  employeeLogs: any[] = [];
  showLogsModal = false;

  // Face Enrollment state
  showFaceEnrollModal = false;
  enrollingEmployee: any = null;
  faceEnrollStream: MediaStream | null = null;
  faceEnrollMessage = 'Chargement des modèles d\'IA...';
  faceEnrollError = '';
  capturedDescriptor: any = null;
  private faceEnrollInterval: any = null;

  // Employee edit state
  isEditingEmp = false;
  editingEmpId = '';

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
    private reservationService: ReservationService,
    private faceAuthService: FaceAuthService
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
      position: this.empPosition,
      shiftStart: this.empShiftStart,
      shiftEnd: this.empShiftEnd
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Employé créé ! Un email avec ses identifiants lui a été envoyé.');
        this.empName = this.empEmail = this.empPassword = this.empPhone = this.empParkingId = '';
        this.empShiftStart = '08:00';
        this.empShiftEnd = '17:00';
        this.loadEmployees();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur', 'error');
      }
    });
  }

  startEditEmployee(emp: any): void {
    this.isEditingEmp = true;
    this.editingEmpId = emp._id;
    this.empName = emp.name;
    this.empEmail = emp.email;
    this.empPhone = emp.phone || '';
    this.empParkingId = emp.parkingId || '';
    this.empPosition = emp.position || 'agent';
    this.empShiftStart = emp.shiftStart || '08:00';
    this.empShiftEnd = emp.shiftEnd || '17:00';
  }

  cancelEditEmployee(): void {
    this.isEditingEmp = false;
    this.editingEmpId = '';
    this.empName = '';
    this.empEmail = '';
    this.empPassword = '';
    this.empPhone = '';
    this.empParkingId = '';
    this.empPosition = 'agent';
    this.empShiftStart = '08:00';
    this.empShiftEnd = '17:00';
  }

  onUpdateEmployee(event: Event): void {
    event.preventDefault();
    if (!this.empName || !this.empPhone || !this.empParkingId) {
      this.showToast('Veuillez remplir tous les champs obligatoires (Nom, Téléphone, Parking)', 'error');
      return;
    }
    this.isLoading = true;
    this.userService.updateUser(this.editingEmpId, {
      name: this.empName,
      phone: this.empPhone,
      parkingId: this.empParkingId,
      position: this.empPosition,
      shiftStart: this.empShiftStart,
      shiftEnd: this.empShiftEnd
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Employé mis à jour avec succès !');
        this.cancelEditEmployee();
        this.loadEmployees();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la modification', 'error');
      }
    });
  }

  onDeleteEmployee(id: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé ? Cette action est irréversible.')) {
      return;
    }
    this.isLoading = true;
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Employé supprimé avec succès.');
        if (this.isEditingEmp && this.editingEmpId === id) {
          this.cancelEditEmployee();
        }
        this.loadEmployees();
      },
      error: (e) => {
        this.isLoading = false;
        this.showToast(e.error?.message || 'Erreur lors de la suppression', 'error');
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

  viewEmployeeLogs(emp: any): void {
    this.selectedEmployeeForLogs = emp;
    this.employeeLogs = [];
    this.showLogsModal = true;
    this.isLoading = true;
    this.userService.getEmployeeLogs(emp._id).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.employeeLogs = res.data || [];
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('Erreur lors du chargement des logs.', 'error');
      }
    });
  }

  closeLogsModal(): void {
    this.showLogsModal = false;
    this.selectedEmployeeForLogs = null;
    this.employeeLogs = [];
  }

  // ─── Enrôlement Visage Employé ─────────────────────────────────────────────

  public startFaceEnroll(emp: any): void {
    this.enrollingEmployee = emp;
    this.showFaceEnrollModal = true;
    this.faceEnrollError = '';
    this.capturedDescriptor = null;
    this.faceEnrollMessage = 'Chargement des modèles d\'IA...';

    this.faceAuthService.loadModels().subscribe({
      next: () => {
        this.faceEnrollMessage = 'Accès à la caméra...';
        navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } })
          .then(stream => {
            this.faceEnrollStream = stream;
            const video = document.getElementById('faceEnrollVideo') as HTMLVideoElement;
            if (video) {
              video.srcObject = stream;
              this.faceEnrollMessage = 'Regardez la caméra et cliquez sur "Capturer"';
              // Check periodically if a face is visible to guide user
              this.startEnrollDetectionLoop(video);
            }
          })
          .catch(err => {
            console.error(err);
            this.faceEnrollError = 'Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.';
          });
      },
      error: () => {
        this.faceEnrollError = 'Erreur lors du chargement des modèles de reconnaissance faciale.';
      }
    });
  }

  private startEnrollDetectionLoop(video: HTMLVideoElement): void {
    if (this.faceEnrollInterval) clearInterval(this.faceEnrollInterval);
    
    this.faceEnrollInterval = setInterval(() => {
      if (video.paused || video.ended || this.capturedDescriptor) return;
      
      this.faceAuthService.getFaceDescriptor(video).subscribe({
        next: (descriptor) => {
          if (descriptor) {
            this.faceEnrollMessage = 'Visage prêt pour la capture !';
          } else {
            this.faceEnrollMessage = 'Aucun visage détecté. Cadrez bien le visage dans le cercle.';
          }
        }
      });
    }, 1000);
  }

  public captureFace(): void {
    const video = document.getElementById('faceEnrollVideo') as HTMLVideoElement;
    if (!video) return;

    this.faceEnrollMessage = 'Analyse du visage...';
    this.faceAuthService.getFaceDescriptor(video).subscribe({
      next: (descriptor) => {
        if (descriptor) {
          this.capturedDescriptor = Array.from(descriptor);
          this.faceEnrollMessage = 'Visage capturé avec succès ! Enregistrez pour finaliser.';
          if (this.faceEnrollInterval) {
            clearInterval(this.faceEnrollInterval);
            this.faceEnrollInterval = null;
          }
        } else {
          this.faceEnrollMessage = 'Échec de la capture : aucun visage détecté. Veuillez réaligner.';
        }
      },
      error: () => {
        this.faceEnrollMessage = 'Erreur lors de la capture. Réessayez.';
      }
    });
  }

  public saveFaceEnroll(): void {
    if (!this.capturedDescriptor || !this.enrollingEmployee) return;

    this.isLoading = true;
    this.faceAuthService.enrollFace(this.enrollingEmployee._id, this.capturedDescriptor).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Visage enregistré avec succès ! L\'employé peut se connecter par visage.');
        this.closeFaceEnrollModal();
        this.loadEmployees(); // Refresh list to update badge
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de l\'enregistrement.', 'error');
      }
    });
  }

  public deleteFaceEnroll(emp: any): void {
    if (!confirm(`Supprimer le visage enregistré pour ${emp.name} ?`)) return;

    this.isLoading = true;
    this.faceAuthService.deleteFace(emp._id).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Visage supprimé avec succès.');
        this.loadEmployees();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Erreur lors de la suppression.', 'error');
      }
    });
  }

  public closeFaceEnrollModal(): void {
    if (this.faceEnrollInterval) {
      clearInterval(this.faceEnrollInterval);
      this.faceEnrollInterval = null;
    }
    if (this.faceEnrollStream) {
      this.faceEnrollStream.getTracks().forEach((track: any) => track.stop());
      this.faceEnrollStream = null;
    }
    this.showFaceEnrollModal = false;
    this.enrollingEmployee = null;
    this.capturedDescriptor = null;
  }
}
