import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private spotsUpdateSubject = new Subject<any>();
  private reservationUpdatedSubject = new Subject<any>();

  constructor() {
    // Extract base URL from environment.apiUrl (which is http://localhost:5000/api)
    // to get http://localhost:5000 for Socket.IO
    const url = environment.apiUrl.replace('/api', '');
    this.socket = io(url, {
      autoConnect: false,
      reconnection: true
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });

    this.socket.on('spots-update', (data: any) => {
      this.spotsUpdateSubject.next(data);
    });

    this.socket.on('reservation-updated', (data: any) => {
      this.reservationUpdatedSubject.next(data);
    });
  }

  public connect(): void {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  public disconnect(): void {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }
  }

  public joinParking(parkingId: string): void {
    this.connect();
    if (this.socket) {
      this.socket.emit('join-parking', parkingId);
    }
  }

  public leaveParking(parkingId: string): void {
    if (this.socket) {
      this.socket.emit('leave-parking', parkingId);
    }
  }

  public onSpotsUpdate(): Observable<any> {
    return this.spotsUpdateSubject.asObservable();
  }

  public onReservationUpdated(): Observable<any> {
    return this.reservationUpdatedSubject.asObservable();
  }
}
