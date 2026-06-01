import { Component, OnInit } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-company',
  templateUrl: './company.component.html',
  styleUrls: ['./company.component.css']
})
export class CompanyComponent implements OnInit {
  activeSection: 'parking' | 'employees' | 'profile' = 'parking';
  profile: any = null;
  employees: any[] = [];

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

  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  isLoading = false;

  constructor(private userService: UserService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadEmployees();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadProfile(): void {
    this.userService.getMe().subscribe({ next: r => this.profile = r.user });
  }

  loadEmployees(): void {
    this.userService.getEmployees().subscribe({ next: r => this.employees = r.employees || [] });
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

  onUpdateProfile(event: Event): void {
    event.preventDefault();
    this.userService.updateMe({ name: this.profile.name, phone: this.profile.phone }).subscribe({
      next: (r) => {
        this.profile = r.user;
        this.authService.updateCurrentUserValue({ name: r.user.name });
        this.showToast('Profil mis à jour.');
      },
      error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
    });
  }
}
