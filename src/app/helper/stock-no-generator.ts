// stock-no-generator.ts
export interface StockNoParts {
    make: string;
    model: string;
    engine: number | string;
  }
  export class StockNoGenerator {
    static generate(
      parts: StockNoParts,
      sequence: number,
      date: Date = new Date()
    ): string {
      const makeInitial  = parts.make?.charAt(0).toUpperCase()  || '0';
      const modelInitial = parts.model?.charAt(0).toUpperCase() || '0';
      const engine       = parts.engine != null ? String(parts.engine) : '';
  
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year  = String(date.getFullYear()).slice(-2);
      const seq   = String(sequence).padStart(3, '0');
  
      return `${makeInitial}-${modelInitial}-${engine}-${month}${year}-${seq}`;
    }
  }