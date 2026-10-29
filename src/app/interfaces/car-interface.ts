export interface CarInterface {}

export interface Photo {
  url: string;
}

export interface SaveCarResponse {
  id: string;
  stockNo?: string;
}

export interface DecodedVin {
  make?: string;
  model?: string;
  year?: number;
  body?: string;
  engine?: number;
  drive?: string;
  transmission?: string;
  fuel?: string;
}

export interface Doc {
  label: string;
  file: File | null;
  serverName?: string;
}

export interface Notice {
  kind: 'ok' | 'err';
  text: string;
}

export interface CarRecord {
  id: string;
  stockNo: string;
  status: 'draft' | 'submitted';
  make: string;
  model: string;
  year: number;
  body?: string;
  colour?: string;
  mileage: number;
  engine: number;
  drive: string;
  transmission: string;
  fuel: string;
  vin?: string;
  source: string;
  branch: string;
  cost: number;
  price: number;
  negotiable: boolean;
  financing: boolean;
  notes?: string;
  showOnWeb: boolean;
  salesperson: string;
  recommended: boolean;
  reviewVideoUrl?: string;
  photos: string[];
  features: string[];
  availabilityStatus?: 'inStock' | 'reserved';
  banks: string[];
  documents: { label: string; fileName: string }[];
  createdAt?: string;
  updatedAt?: string;
}

/** Pagination block returned by POST /cars/search. */
export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Normalised result of a car list/search call. */
export interface CarListResult {
  cars: CarRecord[];
  pagination: Pagination;
  count: number;
}