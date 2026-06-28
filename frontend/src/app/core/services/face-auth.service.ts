import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import * as faceapi from '@vladmandic/face-api';

@Injectable({
  providedIn: 'root'
})
export class FaceAuthService {
  private apiUrl = 'http://localhost:5000/api';
  private modelsLoaded = new BehaviorSubject<boolean>(false);
  public modelsLoaded$ = this.modelsLoaded.asObservable();
  private isLoadingModels = false;

  constructor(private http: HttpClient) {}

  /**
   * Load face-api.js models from local assets folder
   */
  public loadModels(): Observable<boolean> {
    if (this.modelsLoaded.value) {
      return from([true]);
    }
    if (this.isLoadingModels) {
      return this.modelsLoaded$.pipe(
        switchMap(() => from([this.modelsLoaded.value]))
      );
    }

    this.isLoadingModels = true;
    console.log('🤖 Loading face-api.js models...');
    const loadPromise = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    ]).then(() => {
      console.log('🤖 face-api.js models loaded successfully!');
      this.modelsLoaded.next(true);
      this.isLoadingModels = false;
      return true;
    }).catch(err => {
      console.error('❌ Failed to load face-api.js models:', err);
      this.isLoadingModels = false;
      throw err;
    });

    return from(loadPromise);
  }

  /**
   * Capture a frame from video element and calculate its face descriptor
   */
  public getFaceDescriptor(videoElement: HTMLVideoElement): Observable<any> {
    const detectPromise = (faceapi.detectSingleFace(videoElement)
      .withFaceLandmarks()
      .withFaceDescriptor() as any)
      .then((result: any) => {
        if (result) {
          return result.descriptor;
        }
        return null;
      });
    return from(detectPromise);
  }

  /**
   * Call backend to enroll a face descriptor for a specific employee
   */
  public enrollFace(employeeId: string, descriptor: number[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/employees/${employeeId}/face`, { descriptor });
  }

  /**
   * Call backend to delete a face descriptor for a specific employee
   */
  public deleteFace(employeeId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/users/employees/${employeeId}/face`);
  }

  /**
   * Call backend to authenticate user using facial descriptor
   */
  public faceLogin(descriptor: number[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/face-login`, { descriptor });
  }
}
