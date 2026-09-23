import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const API = '/api/v1';

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  status: number;
}

/** Normalise anything the server (or the network) throws into one shape. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    const b = e.error?.error;
    if (b?.code) {
      return { code: b.code, message: b.message, fieldErrors: b.fieldErrors, status: e.status };
    }
    if (e.status === 0) {
      return { code: 'OFFLINE', message: 'Cannot reach the server. Check your connection.', status: 0 };
    }
    return { code: 'UNKNOWN', message: e.message || 'Something went wrong.', status: e.status };
  }
  return { code: 'UNKNOWN', message: 'Something went wrong.', status: 0 };
}

/** Drop undefined/null/'' so they never reach the query string. */
export function params(obj: Record<string, unknown>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  get<T>(path: string, query: Record<string, unknown> = {}): Observable<T> {
    return this.http
      .get<T>(`${API}${path}`, { params: params(query), withCredentials: true })
      .pipe(catchError(e => throwError(() => toApiError(e))));
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .post<T>(`${API}${path}`, body, { withCredentials: true })
      .pipe(catchError(e => throwError(() => toApiError(e))));
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .patch<T>(`${API}${path}`, body, { withCredentials: true })
      .pipe(catchError(e => throwError(() => toApiError(e))));
  }

  /** For the CSV export, which is not JSON. */
  getBlob(path: string, query: Record<string, unknown> = {}): Observable<Blob> {
    return this.http
      .get(`${API}${path}`, { params: params(query), withCredentials: true, responseType: 'blob' })
      .pipe(catchError(e => throwError(() => toApiError(e))));
  }
}
