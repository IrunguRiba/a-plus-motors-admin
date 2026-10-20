import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Output,
  computed,
  signal,
} from '@angular/core';

type Bank = 'Stanbic Bank' | 'KCB' | 'NCBA' | 'Absa';

interface FinanceRow {
  stock: string;
  name: string;
  km: number;
  price: number;
  bank: Bank;
  rate: number;
  deposit: number;
  term: number;
  pending: number;
  active: boolean;
  pickup?: boolean;
}

interface Suggestion {
  stock: string;
  name: string;
  km: number;
  price: number;
  pickup?: boolean;
}

@Component({
  selector: 'app-financing',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './financing.html',
  styleUrls: ['./financing.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Financing {
  /** "+ Add car to financing" was clicked. */
  @Output() addRequested = new EventEmitter<void>();
  /** "Edit rate / deposit" was clicked — payload is the selected stock numbers. */
  @Output() editTerms = new EventEmitter<string[]>();
  /** Fires whenever the financed list changes. */
  @Output() changed = new EventEmitter<FinanceRow[]>();

  readonly banks: Bank[] = ['Stanbic Bank', 'KCB', 'NCBA', 'Absa'];
  private readonly colors: Record<Bank, string> = {
    'Stanbic Bank': '#1b4fd8',
    KCB: '#1a8a4a',
    NCBA: '#b45f06',
    Absa: '#8b1c4a',
  };

  readonly stats = [
    { label: 'Cars with financing', value: '18', sub: 'of 42 in inventory' },
    { label: 'Pending applications', value: '7', sub: 'across 5 cars · 2 need review' },
    { label: 'Approved this month', value: '11', sub: 'KES 38.4M financed' },
    { label: 'Partner banks', value: '4', sub: 'Stanbic · KCB · NCBA · Absa' },
  ];

  /* ---------- state ---------- */
  query = signal('');
  bank = signal<string>('all');
  selected = signal<Set<string>>(new Set(['AP-0219', 'AP-0227']));
  partnerMenu = signal(false);

  all = signal<FinanceRow[]>([
    { stock: 'AP-0243', name: 'Toyota Harrier 2021', km: 42000, price: 4250000, bank: 'Stanbic Bank', rate: 12.5, deposit: 20, term: 60, pending: 3, active: true },
    { stock: 'AP-0238', name: 'Mazda CX-5 2020', km: 58000, price: 3650000, bank: 'KCB', rate: 13, deposit: 20, term: 60, pending: 1, active: true },
    { stock: 'AP-0231', name: 'Subaru Forester 2019', km: 71000, price: 2980000, bank: 'NCBA', rate: 13.5, deposit: 25, term: 48, pending: 0, active: true },
    { stock: 'AP-0219', name: 'Toyota Hilux 2020', km: 55000, price: 4800000, bank: 'Absa', rate: 12.5, deposit: 15, term: 72, pending: 2, active: true, pickup: true },
    { stock: 'AP-0214', name: 'Mercedes C200 2019', km: 49000, price: 5200000, bank: 'Stanbic Bank', rate: 14, deposit: 20, term: 60, pending: 0, active: true },
    { stock: 'AP-0209', name: 'Nissan X-Trail 2018', km: 83000, price: 2750000, bank: 'KCB', rate: 13, deposit: 25, term: 48, pending: 1, active: true },
    { stock: 'AP-0227', name: 'Honda Fit 2018', km: 64000, price: 1450000, bank: 'NCBA', rate: 14.5, deposit: 10, term: 36, pending: 0, active: true },
    { stock: 'AP-0192', name: 'Mazda Demio 2019', km: 52000, price: 1320000, bank: 'Absa', rate: 13.5, deposit: 20, term: 48, pending: 0, active: true },
    { stock: 'AP-0187', name: 'Toyota Prado 2017', km: 98000, price: 6400000, bank: 'Stanbic Bank', rate: 14, deposit: 30, term: 72, pending: 2, active: true },
  ]);

  suggestions = signal<Suggestion[]>([
    { stock: 'AP-0198', name: 'Toyota Axio 2017', km: 76000, price: 1380000 },
    { stock: 'AP-0180', name: 'Subaru Impreza 2017', km: 88000, price: 1690000 },
    { stock: 'AP-0176', name: 'Isuzu D-Max 2019', km: 61000, price: 3900000, pickup: true },
  ]);

  /* ---------- derived ---------- */
  rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const b = this.bank();
    return this.all().filter(
      (r) =>
        (b === 'all' || r.bank === b) &&
        (!q || r.name.toLowerCase().includes(q) || r.stock.toLowerCase().includes(q))
    );
  });
  selectedCount = computed(() => this.selected().size);
  allSelectedPaused = computed(() => {
    const sel = this.selected();
    const rows = this.all().filter((r) => sel.has(r.stock));
    return rows.length > 0 && rows.every((r) => !r.active);
  });

  /* ---------- helpers ---------- */
  val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }
  fmt(n: number): string {
    return n.toLocaleString('en-US');
  }
  color(b: Bank | string): string {
    return this.colors[b as Bank] ?? '#999';
  }

  private commit(next: FinanceRow[]): void {
    this.all.set(next);
    this.changed.emit(next);
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.partnerMenu.set(false);
  }

  /* ---------- selection ---------- */
  toggleSel(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ---------- row actions ---------- */
  toggleActive(id: string): void {
    this.commit(this.all().map((r) => (r.stock === id ? { ...r, active: !r.active } : r)));
  }

  remove(id: string): void {
    const row = this.all().find((r) => r.stock === id);
    this.commit(this.all().filter((r) => r.stock !== id));
    this.selected.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (row) {
      this.suggestions.update((l) => [...l, { stock: row.stock, name: row.name, km: row.km, price: row.price, pickup: row.pickup }]);
    }
  }

  /* ---------- bulk actions ---------- */
  togglePartnerMenu(e: Event): void {
    e.stopPropagation();
    this.partnerMenu.update((v) => !v);
  }

  changePartner(bank: Bank): void {
    const sel = this.selected();
    this.commit(this.all().map((r) => (sel.has(r.stock) ? { ...r, bank } : r)));
    this.partnerMenu.set(false);
  }

  bulkPause(): void {
    const sel = this.selected();
    const resume = this.allSelectedPaused();
    this.commit(this.all().map((r) => (sel.has(r.stock) ? { ...r, active: resume } : r)));
  }

  bulkRemove(): void {
    const sel = this.selected();
    const removed = this.all().filter((r) => sel.has(r.stock));
    this.commit(this.all().filter((r) => !sel.has(r.stock)));
    this.selected.set(new Set());
    this.suggestions.update((l) => [
      ...l,
      ...removed.map((r) => ({ stock: r.stock, name: r.name, km: r.km, price: r.price, pickup: r.pickup })),
    ]);
  }

  /* ---------- suggestions ---------- */
  enable(c: Suggestion): void {
    this.suggestions.update((l) => l.filter((s) => s.stock !== c.stock));
    this.commit([
      ...this.all(),
      {
        stock: c.stock, name: c.name, km: c.km, price: c.price,
        bank: 'Stanbic Bank', rate: 14, deposit: 20, term: 60,
        pending: 0, active: true, pickup: c.pickup,
      },
    ]);
  }
}