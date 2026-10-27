import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SaveCarResponse, DecodedVin, CarRecord } from './interfaces/car-interface';
import { StockNoGenerator } from './helper/stock-no-generator';

export type { DecodedVin } from './interfaces/car-interface';
export type { SaveCarResponse } from './interfaces/car-interface';
export const API_URL = 'https://a-plus-motors-admin-backend.onrender.com/api/admin';

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

/* ------------------------------------------------------------------
   Response normalisation helpers
   ------------------------------------------------------------------ */

/** Unwrap common envelopes: { car }, { data }, { result }, { record }, { item }. */
function unwrap<T>(res: unknown): T | null {
  if (res == null) return null;
  if (Array.isArray(res)) return (res[0] as T) ?? null;
  if (typeof res !== 'object') return null;

  const o = res as Record<string, unknown>;
  for (const key of ['car', 'data', 'result', 'record', 'item', 'doc', 'vehicle']) {
    const v = o[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
  }
  return res as T;
}

/** Pick the first defined value for any of the given keys. */
function pick<T = unknown>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  return String(v);
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = cleaned ? Number(cleaned) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      /* not JSON */
    }
    return [v];
  }
  return [];
}
function normaliseCar(raw: unknown): CarRecord | null {
  const src = unwrap<Record<string, unknown>>(raw);
  if (!src) return null;

  const photosRaw = pick<unknown>(src, 'photos', 'images', 'photoUrls');
  const photos: string[] = Array.isArray(photosRaw)
    ? photosRaw
        .map((p) => (typeof p === 'string' ? p : (p as Record<string, unknown>)?.['url']))
        .filter((p): p is string => typeof p === 'string')
    : asStringArray(photosRaw);

  const docsRaw = pick<unknown>(src, 'documents', 'docs', 'files');
  const documents: { label: string; fileName: string }[] = Array.isArray(docsRaw)
    ? docsRaw
        .map((d) => {
          if (typeof d === 'string') return { label: d, fileName: d };
          if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>;
            return {
              label: asString(o['label'] ?? o['name'] ?? ''),
              fileName: asString(o['fileName'] ?? o['filename'] ?? o['name'] ?? ''),
            };
          }
          return null;
        })
        .filter((d): d is { label: string; fileName: string } => !!d && !!d.label)
    : [];

  return {
    id: asString(pick(src, 'id', '_id')),
    stockNo: asString(pick(src, 'stockNo', 'stockNumber', 'stock_no')),
    status: (pick<'draft' | 'submitted'>(src, 'status') ?? 'draft') as 'draft' | 'submitted',

    make: asString(pick(src, 'make', 'brand', 'vehicleMake')),
    model: asString(pick(src, 'model', 'modelName', 'vehicleModel')),
    year: asNumber(pick(src, 'year', 'modelYear', 'manufactureYear'), new Date().getFullYear()),
    body: asString(pick(src, 'body', 'bodyType', 'bodyClass')),
    colour: asString(pick(src, 'colour', 'color', 'exteriorColor')),

    mileage: asNumber(pick(src, 'mileage', 'odometer', 'km')),
    engine: asNumber(pick(src, 'engine', 'engineCapacity', 'cc', 'displacement')),
    drive: asString(pick(src, 'drive', 'driveType', 'drivetrain'), '2WD'),
    transmission: asString(
      pick(src, 'transmission', 'gearbox', 'transmissionType'),
      'Automatic',
    ),
    fuel: asString(pick(src, 'fuel', 'fuelType'), 'Petrol'),
    vin: asString(pick(src, 'vin', 'chassisNo', 'chassisNumber', 'vinNumber')),

    source: asString(pick(src, 'source', 'acquisitionSource'), 'Trade-in'),
    branch: asString(pick(src, 'branch', 'yard', 'location'), 'Main Yard'),
    cost: asNumber(pick(src, 'cost', 'purchaseCost', 'purchasePrice', 'buyPrice')),
    price: asNumber(pick(src, 'price', 'sellingPrice', 'askingPrice')),
    negotiable: asBool(pick(src, 'negotiable', 'isNegotiable')),
    financing: asBool(pick(src, 'financing', 'isFinancing')),

    notes: asString(pick(src, 'notes', 'internalNotes')),
    showOnWeb: asBool(pick(src, 'showOnWeb', 'isPublished'), true),
    salesperson: asString(pick(src, 'salesperson', 'assignedTo'), 'Mary Wanjiru'),
    recommended: asBool(pick(src, 'recommended', 'isRecommended')),
    reviewVideoUrl: asString(pick(src, 'reviewVideoUrl', 'videoUrl')),

    photos,
    features: asStringArray(pick(src, 'features', 'featureList')),
    availabilityStatus: pick<'inStock' | 'researved'>(
      src,
      'availabilityStatus',
      'availability',
    ),
    banks: asStringArray(pick(src, 'banks', 'financingBanks')),
    documents,
  };
}

@Injectable({ providedIn: 'root' })
export class CarService {
  private readonly http = inject(HttpClient);

  createCar(
    data: Record<string, unknown>,
    photos: File[],
    documents: File[],
  ): Observable<SaveCarResponse> {
    return this.http.post<SaveCarResponse>(
      `${API_URL}/cars`,
      this.buildFormData(data, photos, documents),
    );
  }
  updateCar(
    data: Record<string, unknown>,
    photos: File[] = [],
    documents: File[] = [],
  ): Observable<SaveCarResponse> {
    return this.http.patch<SaveCarResponse>(
      `${API_URL}/cars/update`,
      this.buildFormData(data, photos, documents),
    );
  }
  saveCar(
    id: string | null,
    data: Record<string, unknown>,
    photos: File[],
    documents: File[],
  ): Observable<SaveCarResponse> {
    return id
      ? this.updateCar({ ...data, id }, photos, documents)
      : this.createCar(data, photos, documents);
  }
  getCarByStockNo(stockNo: string): Observable<CarRecord> {
    return this.http
      .post<unknown>(`${API_URL}/cars/find`, { stockNo })
      .pipe(
        map((res) => {
          const car = normaliseCar(res);
          if (!car) {
            throw new Error(`No car found for stock number "${stockNo}".`);
          }
          return car;
        }),
      );
  }
  getCarById(id: string): Observable<CarRecord> {
    return this.http
      .post<unknown>(`${API_URL}/cars/find`, { id })
      .pipe(
        map((res) => {
          const car = normaliseCar(res);
          if (!car) throw new Error(`No car found for id "${id}".`);
          return car;
        }),
      );
  }
  searchCar(body: Record<string, unknown> = {}): Observable<unknown> {
    return this.http.post(`${API_URL}/cars/search`, body);
  }
  deleteCar(locator: { stockNo?: string; id?: string; _id?: string }): Observable<unknown> {
    return this.http.delete(`${API_URL}/cars/delete`, { body: locator });
  }
  generateStockNo(
    make: string,
    model: string,
    engine: number | string,
  ): Observable<string> {
    return this.http
      .get<{ sequence: number }>(`${API_URL}/cars/next-sequence`)
      .pipe(
        map(({ sequence }) =>
          StockNoGenerator.generate({ make, model, engine }, sequence),
        ),
      );
  }

  /**
   * Decodes a VIN with the free NHTSA vPIC service (CORS-enabled).
   */
  decodeVin(vin: string): Observable<DecodedVin> {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(
      vin,
    )}?format=json`;

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

        (Object.keys(out) as (keyof DecodedVin)[]).forEach(
          (k) => out[k] === undefined && delete out[k],
        );
        return out;
      }),
    );
  }

  private buildFormData(
    data: Record<string, unknown>,
    photos: File[],
    documents: File[],
  ): FormData {
    const body = new FormData();
    body.append('data', JSON.stringify(data));
    photos.forEach((f) => body.append('photos', f, f.name));
    documents
      .filter((f) => f.size > 0) // skip placeholder files that only carry a server name
      .forEach((f) => body.append('documents', f, f.name));
    return body;
  }
}