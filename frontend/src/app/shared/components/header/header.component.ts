import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IAService } from '../../../core/services/ia.service';
import { MockEmailService } from '../../../core/services/mock-email.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  // UI states
  showChat = false;
  showMailbox = false;
  isLoadingChat = false;
  isLoadingMail = false;

  // AI Chat state
  chatMessage = '';
  chatHistory: Array<{ sender: 'user' | 'bot'; text: string }> = [
    { sender: 'bot', text: 'Bonjour ! Je suis votre assistant virtuel Smart Parking. Posez-moi des questions sur les places libres, les forfaits d\'abonnements ou les parkings en Tunisie !' }
  ];
  suggestions: string[] = ['Parkings à Tunis', 'Tarifs abonnements', 'Aide', 'Dernière réservation'];

  // Mailbox state
  mockEmails: any[] = [];
  private mailInterval: any = null;

  constructor(
    public authService: AuthService,
    public router: Router,
    private iaService: IAService,
    private mockEmailService: MockEmailService
  ) {}

  ngOnInit(): void {
    // If user is already logged in, start fetching emails occasionally
    if (this.authService.isLoggedIn()) {
      this.loadMockEmails();
      this.mailInterval = setInterval(() => {
        if (this.showMailbox) {
          this.loadMockEmails();
        }
      }, 5000);
    }
  }

  ngOnDestroy(): void {
    if (this.mailInterval) {
      clearInterval(this.mailInterval);
    }
  }

  logout(): void {
    this.authService.logout();
    this.showChat = false;
    this.showMailbox = false;
    this.router.navigate(['/auth']);
  }

  getRoleBadge(): string {
    const role = this.authService.getRole();
    const map: Record<string, string> = {
      super_admin: 'Administrateur',
      company: 'Entreprise',
      employee: 'Employé',
      client: 'Client'
    };
    return map[role || ''] || role || '';
  }

  // AI Chat functions
  toggleChat(): void {
    this.showChat = !this.showChat;
    if (this.showChat) {
      this.showMailbox = false;
    }
  }

  sendChatMessage(messageText?: string): void {
    const textToSend = messageText || this.chatMessage;
    if (!textToSend.trim()) return;

    // Add user message to history
    this.chatHistory.push({ sender: 'user', text: textToSend });
    if (!messageText) {
      this.chatMessage = '';
    }

    this.isLoadingChat = true;
    const currentUser = this.authService.currentUserValue;

    const payload = {
      message: textToSend,
      userId: currentUser?.id || 'anonymous',
      userName: currentUser?.name || 'Client',
      userEmail: currentUser?.email || 'client@example.com',
      coordinates: null // Tunisian fallback coordinates are handled by backend
    };

    this.iaService.chat(payload).subscribe({
      next: (res) => {
        this.isLoadingChat = false;
        this.chatHistory.push({ sender: 'bot', text: res.reply });
        if (res.suggestions && res.suggestions.length > 0) {
          this.suggestions = res.suggestions;
        }
      },
      error: (err) => {
        this.isLoadingChat = false;
        this.chatHistory.push({ sender: 'bot', text: 'Désolé, l\'assistant IA est momentanément indisponible.' });
      }
    });
  }

  clickSuggestion(s: string): void {
    this.sendChatMessage(s);
  }

  // Mock Mailbox functions
  toggleMailbox(): void {
    this.showMailbox = !this.showMailbox;
    if (this.showMailbox) {
      this.showChat = false;
      this.loadMockEmails();
    }
  }

  loadMockEmails(): void {
    this.isLoadingMail = true;
    this.mockEmailService.getMockEmails().subscribe({
      next: (res) => {
        this.isLoadingMail = false;
        this.mockEmails = res.emails || [];
      },
      error: () => {
        this.isLoadingMail = false;
      }
    });
  }

  clearMailbox(): void {
    if (!confirm('Voulez-vous vider la boîte de réception virtuelle ?')) return;

    this.isLoadingMail = true;
    this.mockEmailService.deleteMockEmails().subscribe({
      next: () => {
        this.isLoadingMail = false;
        this.mockEmails = [];
        this.loadMockEmails();
      },
      error: () => {
        this.isLoadingMail = false;
      }
    });
  }
}
