export interface CarInterface {}
export interface Doc {
    label: string;
    file: File | null;
  }
  export interface Photo {
    url: string;
  }
  export interface Notice {
    kind: 'ok' | 'err';
    text: string;
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
  
  export interface SaveCarResponse {
    id: string;
    stockNo?: string;
  }