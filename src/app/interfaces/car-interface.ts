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

export interface FinanceRecord {
  enabled: boolean;
  banks: string[];
  primaryBank?: string;
  bankFullName?: string;
  bankLogo?: string;
  bankColor?: string;
  rate?: number;
  deposit?: number;
  term?: number;
  maxAmount?: number;
  monthly?: number;
  pending: number;
  active: boolean;
  overrides?: {
    rate?: number;
    deposit?: number;
    term?: number;
    note?: string;
  };
  bankDetails?: {
    bank: string;
    fullName: string;
    logo: string;
    color: string;
  }[];
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
  finance?: FinanceRecord;
  createdAt?: string;
  updatedAt?: string;
  
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CarListResult {
  cars: CarRecord[];
  pagination: Pagination;
  count: number;
}

export interface FinancePartner {
  _id: string;
  bank: string;
  fullName: string;
  logo: string;
  color: string;
  active: boolean;
  defaults: {
    rate: number;
    deposit: number;
    term: number;
    maxRate?: number;
  };
}

export const FINANCE_PARTNERS_FALLBACK: FinancePartner[] = [
  { _id: 'nic',     bank: 'NIC Group',     fullName: 'National Industrial Credit Bank',    logo: '/logos/finance/nic-group.svg', color: '#0a4d8c', active: true, defaults: { rate: 14,   deposit: 20, term: 60, maxRate: 18 } },
  { _id: 'unaitas', bank: 'UNAITAS SACCO', fullName: 'Unaitas Sacco Society Limited',     logo: '/logos/finance/unaitas.svg',   color: '#1f7a3f', active: true, defaults: { rate: 13,   deposit: 20, term: 60, maxRate: 17 } },
  { _id: 'coop',    bank: 'CO-OP',         fullName: 'Co-operative Bank of Kenya',        logo: '/logos/finance/co-op.svg',     color: '#00693e', active: true, defaults: { rate: 13,   deposit: 20, term: 60, maxRate: 17 } },
  { _id: 'family',  bank: 'FAMILY',        fullName: 'Family Bank Limited',               logo: '/logos/finance/family.svg',    color: '#b02a30', active: true, defaults: { rate: 14,   deposit: 20, term: 60, maxRate: 18 } },
  { _id: 'spire',   bank: 'SPIRE',         fullName: 'Spire Bank Limited',                logo: '/logos/finance/spire.svg',     color: '#2b3a8f', active: true, defaults: { rate: 15,   deposit: 20, term: 60, maxRate: 19 } },
  { _id: 'kwft',    bank: 'KWFT',          fullName: 'Kenya Women Microfinance Bank PLC', logo: '/logos/finance/kwft.svg',      color: '#7a1f6b', active: true, defaults: { rate: 14,   deposit: 15, term: 48, maxRate: 18 } },
  { _id: 'stanbic', bank: 'Stanbic Bank',  fullName: 'Stanbic Bank Kenya Limited',        logo: '/logos/finance/stanbic.svg',   color: '#1b4fd8', active: true, defaults: { rate: 12.5, deposit: 20, term: 60, maxRate: 16 } },
  { _id: 'kcb',     bank: 'KCB',           fullName: 'KCB Bank Kenya Limited',            logo: '/logos/finance/kcb.svg',       color: '#1a8a4a', active: true, defaults: { rate: 13,   deposit: 20, term: 60, maxRate: 17 } },
  { _id: 'ncba',    bank: 'NCBA',          fullName: 'NCBA Bank Kenya PLC',               logo: '/logos/finance/ncba.svg',      color: '#b45f06', active: true, defaults: { rate: 13.5, deposit: 25, term: 48, maxRate: 17.5 } },
  { _id: 'absa',    bank: 'Absa',          fullName: 'Absa Bank Kenya Plc',               logo: '/logos/finance/absa.svg',      color: '#8b1c4a', active: true, defaults: { rate: 12.5, deposit: 15, term: 72, maxRate: 16 } },
];