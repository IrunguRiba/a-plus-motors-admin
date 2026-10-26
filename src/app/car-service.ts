import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SaveCarResponse, DecodedVin } from './interfaces/car-interface';
/** Change this to your backend base URL (or move it into your environment file). */
export const API_URL = '/api';
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

@Injectable({ providedIn: 'root' })
export class CarService {
  private readonly http = inject(HttpClient);

  /**
   * Creates (POST /cars) or updates (PUT /cars/:id) a car.
   * Sent as multipart/form-data:
   *   data      -> JSON string with every field
   *   photos    -> image files, in order (first = cover)
   *   documents -> document files, same order as data.documents
   */
  saveCar(
    id: string | null,
    data: Record<string, unknown>,
    photos: File[],
    documents: File[],
  ): Observable<SaveCarResponse> {
    const body = new FormData();
    body.append('data', JSON.stringify(data));
    photos.forEach((f) => body.append('photos', f, f.name));
    documents.forEach((f) => body.append('documents', f, f.name));

    return id
      ? this.http.put<SaveCarResponse>(`${API_URL}/cars/${id}`, body)
      : this.http.post<SaveCarResponse>(`${API_URL}/cars`, body);
  }

  /**
   * Decodes a VIN with the free NHTSA vPIC service (CORS-enabled).
   * To use your own backend instead, swap the URL for `${API_URL}/vin/decode/${vin}`
   * and return the same DecodedVin shape.
   */
  decodeVin(vin: string): Observable<DecodedVin> {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;

    return this.http.get<{ Results?: Record<string, string>[] }>(url).pipe(
      map((res) => {
        const x = res.Results?.[0] ?? {};
        const out: DecodedVin = {};

        if (x['Make']) out.make = titleCase(x['Make']);
        if (x['Model']) out.model = x['Model'];

        const year = parseInt(x['ModelYear'], 10);
        if (year) out.year = year;

        const cc = Math.round(parseFloat(x['DisplacementCC']));
        if (cc) out.engine = cc;

        const body = (x['BodyClass'] ?? '').toLowerCase();
        if (body) {
          out.body = /sport utility|suv/.test(body)
            ? 'SUV'
            : /sedan|saloon/.test(body)
              ? 'Sedan'
              : /hatchback/.test(body)
                ? 'Hatchback'
                : /pickup/.test(body)
                  ? 'Pickup'
                  : /van/.test(body)
                    ? 'Van'
                    : x['BodyClass'];
        }

        const drive = (x['DriveType'] ?? '').toLowerCase();
        if (drive) {
          out.drive = /4wd|4x4|4-wheel/.test(drive)
            ? '4WD'
            : /awd|all-wheel/.test(drive)
              ? 'AWD'
              : '2WD';
        }

        const trans = (x['TransmissionStyle'] ?? '').toLowerCase();
        if (trans) {
          out.transmission = /cvt|continuously/.test(trans)
            ? 'CVT'
            : /manual/.test(trans)
              ? 'Manual'
              : /automatic/.test(trans)
                ? 'Automatic'
                : undefined;
        }

        const fuel = (x['FuelTypePrimary'] ?? '').toLowerCase();
        const elec = (x['ElectrificationLevel'] ?? '').toLowerCase();
        if (/hev|hybrid/.test(elec) || fuel.includes('hybrid')) out.fuel = 'Hybrid';
        else if (fuel.includes('diesel')) out.fuel = 'Diesel';
        else if (fuel.includes('electric')) out.fuel = 'EV';
        else if (fuel.includes('gasoline')) out.fuel = 'Petrol';

        // drop undefined keys so "found anything?" is just Object.keys().length
        (Object.keys(out) as (keyof DecodedVin)[]).forEach(
          (k) => out[k] === undefined && delete out[k],
        );
        return out;
      }),
    );
  }
}
