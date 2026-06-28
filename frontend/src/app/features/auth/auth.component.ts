import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FaceAuthService } from '../../core/services/face-auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit, OnDestroy {
  activeTab: 'login' | 'register-client' | 'register-company' | 'forgot' | 'reset' = 'login';
  
  // Login inputs
  loginEmail = '';
  loginPassword = '';

  // Client inputs
  clientName = '';
  clientEmail = '';
  clientPassword = '';
  clientPhone = '';
  clientPlate = '';
  clientSerial = '';
  clientVehicleType = 'car';

  // Company inputs
  companyName = '';
  companyEmail = '';
  companyPassword = '';
  companyPhone = '';
  companySiret = '';
  companyAddress = '';

  // Password recovery
  recoverEmail = '';
  resetToken = '';
  resetPasswordVal = '';

  // UI state
  isLoading = false;
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';

  // Face Login state
  showFaceModal = false;
  faceStream: MediaStream | null = null;
  faceDetectionMessage = 'Chargement des modèles d\'IA...';
  faceError = '';
  private faceInterval: any = null;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private faceAuthService: FaceAuthService
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.redirectUser();
    }
  }

  ngOnDestroy(): void {
    this.closeFaceModal();
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 4000);
  }

  switchTab(tab: 'login' | 'register-client' | 'register-company' | 'forgot' | 'reset'): void {
    this.activeTab = tab;
  }

  onLogin(event: Event): void {
    event.preventDefault();
    if (!this.loginEmail || !this.loginPassword) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    this.isLoading = true;
    this.authService.login({ email: this.loginEmail, password: this.loginPassword }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Connexion réussie !');
        this.redirectUser();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Identifiants invalides', 'error');
      }
    });
  }

  onRegisterClient(event: Event): void {
    event.preventDefault();
    if (!this.clientName || !this.clientEmail || !this.clientPassword || !this.clientPhone || !this.clientPlate || !this.clientSerial) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    const payload = {
      name: this.clientName,
      email: this.clientEmail,
      password: this.clientPassword,
      phone: this.clientPhone,
      role: 'client',
      vehiclePlate: this.clientPlate,
      vehicleSerialNumber: this.clientSerial,
      vehicleType: this.clientVehicleType
    };

    this.isLoading = true;
    this.authService.register(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Compte Client créé avec succès !');
        this.redirectUser();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || err.error?.errors?.[0]?.msg || 'Erreur lors de l\'inscription', 'error');
      }
    });
  }

  onRegisterCompany(event: Event): void {
    event.preventDefault();
    if (!this.companyName || !this.companyEmail || !this.companyPassword || !this.companyPhone || !this.companySiret || !this.companyAddress) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    const payload = {
      name: this.companyName,
      email: this.companyEmail,
      password: this.companyPassword,
      phone: this.companyPhone,
      role: 'company',
      siret: this.companySiret,
      address: this.companyAddress
    };

    this.isLoading = true;
    this.authService.register(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Inscription réussie ! Votre compte entreprise est en attente d\'approbation.');
        this.switchTab('login');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || err.error?.errors?.[0]?.msg || 'Erreur lors de l\'inscription', 'error');
      }
    });
  }

  onForgotPassword(event: Event): void {
    event.preventDefault();
    if (!this.recoverEmail) {
      this.showToast('Veuillez saisir votre adresse email', 'error');
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.recoverEmail).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showToast('Lien de réinitialisation généré ! Consultez la boîte mail virtuelle.');
        // Fill token automatically from backend mock response for testing convenience!
        if (res.resetToken) {
          this.resetToken = res.resetToken;
        }
        this.switchTab('reset');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Adresse email introuvable', 'error');
      }
    });
  }

  onResetPassword(event: Event): void {
    event.preventDefault();
    if (!this.resetToken || !this.resetPasswordVal) {
      this.showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    this.isLoading = true;
    this.authService.resetPassword({ token: this.resetToken, password: this.resetPasswordVal }).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('Mot de passe réinitialisé avec succès ! Connectez-vous.');
        this.switchTab('login');
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast(err.error?.message || 'Token invalide ou expiré', 'error');
      }
    });
  }

  redirectUser(): void {
    const role = this.authService.getRole();
    if (role === 'super_admin') {
      this.router.navigate(['/admin']);
    } else if (role === 'company') {
      this.router.navigate(['/company']);
    } else if (role === 'employee') {
      this.router.navigate(['/employee']);
    } else if (role === 'client') {
      this.router.navigate(['/client']);
    } else {
      this.router.navigate(['/auth']);
    }
  }

  // ─── Reconnaissance Faciale ─────────────────────────────────────────────────

  public startFaceLogin(): void {
    this.showFaceModal = true;
    this.faceError = '';
    this.faceDetectionMessage = 'Chargement des modèles d\'IA...';

    // 1. Charge les modèles TensorFlow
    this.faceAuthService.loadModels().subscribe({
      next: () => {
        this.faceDetectionMessage = 'Accès à la caméra...';
        // 2. Active la webcam
        navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } })
          .then(stream => {
            this.faceStream = stream;
            const video = document.getElementById('faceLoginVideo') as HTMLVideoElement;
            if (video) {
              video.srcObject = stream;
              this.faceDetectionMessage = 'Veuillez regarder la caméra...';
              // 3. Démarre la boucle de capture
              this.startDetectionLoop(video);
            }
          })
          .catch(err => {
            console.error(err);
            this.faceError = 'Impossible d\'accéder à la caméra. Veuillez accorder les permissions.';
          });
      },
      error: () => {
        this.faceError = 'Erreur lors du chargement des modèles de reconnaissance faciale.';
      }
    });
  }

  private startDetectionLoop(video: HTMLVideoElement): void {
    if (this.faceInterval) clearInterval(this.faceInterval);
    
    this.faceInterval = setInterval(() => {
      if (video.paused || video.ended) return;

      this.faceAuthService.getFaceDescriptor(video).subscribe({
        next: (descriptor) => {
          if (descriptor) {
            this.faceDetectionMessage = 'Visage détecté ! Authentification en cours...';
            clearInterval(this.faceInterval);
            this.faceInterval = null;

            // Envoi au backend
            const descriptorArray = Array.from(descriptor) as number[];
            this.faceAuthService.faceLogin(descriptorArray).subscribe({
              next: (res) => {
                this.authService.setSession(res.token, res.user);
                this.showToast(res.message);
                this.closeFaceModal();
                this.redirectUser();
              },
              error: (err) => {
                this.faceError = err.error?.message || 'Visage non reconnu. Réessayez.';
                // Relance après 3 secondes si erreur
                setTimeout(() => {
                  if (this.showFaceModal && !this.faceInterval) {
                    this.faceError = '';
                    this.faceDetectionMessage = 'Veuillez regarder la caméra...';
                    this.startDetectionLoop(video);
                  }
                }, 3000);
              }
            });
          } else {
            this.faceDetectionMessage = 'Aucun visage détecté. Veuillez bien vous cadrer.';
          }
        }
      });
    }, 1000); // Analyse chaque seconde
  }

  public closeFaceModal(): void {
    if (this.faceInterval) {
      clearInterval(this.faceInterval);
      this.faceInterval = null;
    }
    if (this.faceStream) {
      this.faceStream.getTracks().forEach((track: any) => track.stop());
      this.faceStream = null;
    }
    this.showFaceModal = false;
  }
}
