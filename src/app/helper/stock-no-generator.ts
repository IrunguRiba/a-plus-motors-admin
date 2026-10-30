// stock-no-generator.ts
export interface StockNoParts {
    make: string;
    model: string;
    engine: number | string;
  }
  export class StockNoGenerator {
    static generate(
      { make, model }: { make: string; model: string; engine?: number | string },
      sequence: number,
    ): string {
      const mi = make ? make.charAt(0).toUpperCase() : '0';
      const mo = model ? model.charAt(0).toUpperCase() : '0';
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const seq = String(sequence).padStart(3, '0');
      return `${mi}${mo}${mm}${yy}-${seq}`;
    }
  }