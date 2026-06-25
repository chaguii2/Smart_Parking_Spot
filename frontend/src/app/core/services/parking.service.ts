import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ParkingService {
  private apiUrl = `${environment.apiUrl}/parking`;

  constructor(private http: HttpClient) {}

  public getParkingLocations(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/map/parkings`);
  }

  public getNearbyParkings(lat: number, lng: number, radius: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/map/parkings/nearby`, {
      params: { lat: lat.toString(), lng: lng.toString(), radius: radius.toString() }
    });
  }

  public getParkingLocationById(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/map/parkings/${parkingId}`);
  }

  public isParkingOpen(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/map/parkings/${parkingId}/is-open`);
  }

  public getMapStatistics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/map/statistics`);
  }

  public getSpotsByParking(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots`);
  }

  public getAvailableSpots(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots/available`);
  }

  public getSpotStats(parkingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots/stats`);
  }

  public searchSpots(parkingId: string, params: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${parkingId}/spots/search`, { params });
  }

  public getSpotById(spotId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/spots/${spotId}`);
  }

  public updateSpotStatus(spotId: string, status: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/spots/${spotId}/status`, { status });
  }

  public generateSpots(parkingId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${parkingId}/generate`, {});
  }

  public startSimulation(parkingId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${parkingId}/simulate/start`, {});
  }

  public stopSimulation(parkingId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${parkingId}/simulate/stop`, {});
  }
}
