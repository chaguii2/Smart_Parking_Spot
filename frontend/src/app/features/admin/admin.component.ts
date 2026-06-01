import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  companies: any[] = [];
  parkings: any[] = [];
  activeSection: 'companies' | 'parkings' = 'companies';
  rejectReason = '';
  rejectTargetId: string | null = null;
  rejectType: 'company' | 'parking' = 'company';
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadCompanies();
    this.loadParkings();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  loadCompanies(): void {
    this.adminService.getCompanies().subscribe({ next: r => this.companies = r.companies || [], error: () => this.showToast('Erreur chargement entreprises', 'error') });
  }

  loadParkings(): void {
    this.adminService.getParkings().subscribe({ next: r => this.parkings = r.parkings || [], error: () => this.showToast('Erreur chargement parkings', 'error') });
  }

  approveCompany(id: string): void {
    this.adminService.approveCompany(id).subscribe({ next: () => { this.showToast('Entreprise approuvée'); this.loadCompanies(); }, error: e => this.showToast(e.error?.message || 'Erreur', 'error') });
  }

  suspendCompany(id: string): void {
    this.adminService.suspendCompany(id).subscribe({ next: () => { this.showToast('Entreprise suspendue'); this.loadCompanies(); }, error: e => this.showToast(e.error?.message || 'Erreur', 'error') });
  }

  openRejectModal(id: string, type: 'company' | 'parking'): void {
    this.rejectTargetId = id;
    this.rejectType = type;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.rejectTargetId) return;
    if (this.rejectType === 'company') {
      this.adminService.rejectCompany(this.rejectTargetId, this.rejectReason).subscribe({ next: () => { this.showToast('Entreprise rejetée'); this.loadCompanies(); this.rejectTargetId = null; }, error: e => this.showToast(e.error?.message || 'Erreur', 'error') });
    } else {
      this.adminService.rejectParking(this.rejectTargetId, this.rejectReason).subscribe({ next: () => { this.showToast('Parking rejeté'); this.loadParkings(); this.rejectTargetId = null; }, error: e => this.showToast(e.error?.message || 'Erreur', 'error') });
    }
  }

  approveParking(id: string): void {
    this.adminService.approveParking(id).subscribe({ next: () => { this.showToast('Parking approuvé'); this.loadParkings(); }, error: e => this.showToast(e.error?.message || 'Erreur', 'error') });
  }
}
