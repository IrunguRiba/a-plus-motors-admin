import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CarService } from '../../../car-service';
import {
  CarRecord,
  FinancePartner,
  FINANCE_PARTNERS_FALLBACK,
} from '../../../interfaces/car-interface';

interface FinanceRow {
  id: string;
  stock: string;
  name: string;
  km: number;
  price: number;
  bank: string;
  banks: string[];
  rate: number;
  deposit: number;
  term: number;
  maxAmount?: number;
  monthly?: number;
  pending: number;
  active: boolean;
  pickup: boolean;
  year: number;
  make: string;
  model: string;
  body?: string;
  colour?: string;
  fuel?: string;
  transmission?: string;
  drive?: string;
  mileage: number;
  note?: string;
}

interface AddCandidate {
  id: string;
  stock: string;
  name: string;
  km: number;
  price: number;
  pickup: boolean;
  bank: string;
}

interface FinanceRecord {
  enabled?: boolean;
  banks?: string[];
  primaryBank?: string;
  bankFullName?: string;
  bankLogo?: string;
  bankColor?: string;
  rate?: number;
  deposit?: number;
  term?: number;
  maxAmount?: number;
  monthly?: number;
  pending?: number;
  active?: boolean;
  overrides?: {
    rate?: number;
    deposit?: number;
    term?: number;
    note?: string;
  };
}

const CLEARED_FINANCE: FinanceRecord = {
  enabled: false,
  banks: [],
  primaryBank: undefined,
  bankFullName: undefined,
  bankLogo: undefined,
  bankColor: undefined,
  rate: undefined,
  deposit: undefined,
  term: undefined,
  maxAmount: undefined,
  monthly: undefined,
  pending: 0,
  active: true,
  overrides: {},
};

@Component({
  selector: 'app-financing',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './financing.html',
  styleUrls: ['./financing.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Financing implements OnInit {
  @Output() addRequested = new EventEmitter<void>();
  @Output() changed = new EventEmitter<FinanceRow[]>();

  private readonly carService = inject(CarService);
  private readonly destroyRef = inject(DestroyRef);

  partners = signal<FinancePartner[]>(FINANCE_PARTNERS_FALLBACK);

  readonly activePartners = computed(() =>
    this.partners().filter((p) => p.active !== false),
  );
  readonly banks = computed(() => this.activePartners().map((p) => p.bank));

  partnerFor(bank: string): FinancePartner | undefined {
    return this.partners().find((p) => p.bank === bank);
  }
  color(bank: string): string {
    return this.partnerFor(bank)?.color ?? '#999';
  }
  logo(bank: string): string {
    return this.partnerFor(bank)?.logo ?? '';
  }

  mode = signal<'search' | 'add'>('search');

  query = signal('');
  bank = signal<string>('all');
  selected = signal<Set<string>>(new Set());
  partnerMenu = signal(false);

  loading = signal(false);
  saving = signal(false);
  notice = signal('');

  all = signal<FinanceRow[]>([]);
  totalInventory = signal(0);

  addQuery = signal('');
  addResults = signal<AddCandidate[]>([]);
  addBusy = signal(false);

  editOpen = signal(false);
  editStocks = signal<string[]>([]);
  editForm = signal({ rate: 14, deposit: 20, term: 60, note: '' });

  detailsOpen = signal(false);
  detailsRow = signal<FinanceRow | null>(null);

  stats = computed(() => {
    const rows = this.all();
    const financed = rows.length;
    const pending = rows.reduce((n, r) => n + r.pending, 0);
    const banks = new Set(rows.flatMap((r) => r.banks)).size;
    const total = this.totalInventory();
    return [
      { label: 'Cars with financing', value: String(financed), sub: `of ${total} in inventory` },
      { label: 'Pending applications', value: String(pending), sub: pending > 0 ? 'need review' : 'none pending' },
      { label: 'Approved this month', value: '—', sub: 'not tracked yet' },
      { label: 'Partner banks', value: String(banks), sub: rows.length ? this.uniqueBanksLabel(rows) : 'none yet' },
    ];
  });

  rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const b = this.bank();
    return this.all().filter(
      (r) =>
        (b === 'all' || r.banks.includes(b)) &&
        (!q || r.name.toLowerCase().includes(q) || r.stock.toLowerCase().includes(q)),
    );
  });

  selectedCount = computed(() => this.selected().size);

  allSelectedPaused = computed(() => {
    const sel = this.selected();
    const rows = this.all().filter((r) => sel.has(r.stock));
    return rows.length > 0 && rows.every((r) => !r.active);
  });

  ngOnInit(): void {
    this.loadPartners();
    this.load();
  }

  loadPartners(): void {
    this.carService
      .getFinancePartners()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          if (Array.isArray(list) && list.length) this.partners.set(list);
        },
        error: () => {},
      });
  }

  load(): void {
    this.loading.set(true);
    this.carService
      .searchCars({ page: 1, limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cars, pagination }) => {
          this.totalInventory.set(pagination.total ?? cars.length);
          const financed: FinanceRow[] = [];
          for (const c of cars) {
            const f = (c as unknown as { finance?: FinanceRecord }).finance;
            if (f?.enabled) financed.push(this.toRow(c, f));
          }
          this.all.set(financed);
          this.notice.set('');
          this.loading.set(false);
        },
        error: () => {
          this.notice.set('Could not load financed cars. Please try again.');
          this.loading.set(false);
        },
      });
  }

  private toRow(c: CarRecord, f: FinanceRecord): FinanceRow {
    const bank = f.primaryBank ?? f.banks?.[0] ?? 'Stanbic Bank';
    const banks =
      Array.isArray(f.banks) && f.banks.length ? [...f.banks] : [bank];
    return {
      id: c.id,
      stock: c.stockNo,
      name: `${this.titleCase(c.make)} ${this.titleCase(c.model)} ${c.year}`,
      make: c.make,
      model: c.model,
      year: c.year,
      body: c.body,
      colour: c.colour,
      fuel: c.fuel,
      transmission: c.transmission,
      drive: c.drive,
      mileage: c.mileage,
      km: c.mileage,
      price: c.price,
      bank,
      banks,
      rate: f.rate ?? this.partnerFor(bank)?.defaults.rate ?? 14,
      deposit: f.deposit ?? this.partnerFor(bank)?.defaults.deposit ?? 20,
      term: f.term ?? this.partnerFor(bank)?.defaults.term ?? 60,
      maxAmount: f.maxAmount,
      monthly: f.monthly,
      pending: f.pending ?? 0,
      active: f.active !== false,
      pickup: (c.body ?? '').toLowerCase().includes('pick'),
      note: f.overrides?.note,
    };
  }

  private titleCase(s: string): string {
    return (s ?? '').toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
  }

  private uniqueBanksLabel(rows: FinanceRow[]): string {
    const set = Array.from(new Set(rows.flatMap((r) => r.banks)));
    return set.slice(0, 4).join(' · ') + (set.length > 4 ? ` +${set.length - 4}` : '');
  }

  val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }
  fmt(n: number): string {
    return n.toLocaleString('en-US');
  }

  banksInline(row: FinanceRow): string {
    return row.banks.join(' · ');
  }

  private commit(next: FinanceRow[]): void {
    this.all.set(next);
    this.changed.emit(next);
  }

  private persist(carId: string, finance: FinanceRecord): void {
    this.saving.set(true);
    this.carService
      .updateCar({ id: carId, finance })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.saving.set(false),
        error: () => {
          this.saving.set(false);
          this.notice.set('Could not save financing changes. Please try again.');
        },
      });
  }

  private fullFinance(row: FinanceRow, patch: Partial<FinanceRecord> = {}): FinanceRecord {
    const banks = row.banks && row.banks.length ? row.banks : [row.bank];
    return {
      enabled: true,
      banks,
      primaryBank: row.bank,
      rate: row.rate,
      deposit: row.deposit,
      term: row.term,
      pending: row.pending,
      active: row.active,
      ...patch,
    };
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.partnerMenu.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closeDetails();
    this.closeEdit();
    this.partnerMenu.set(false);
  }

  enterAddMode(): void {
    this.mode.set('add');
    this.addQuery.set('');
    this.addResults.set([]);
    this.addRequested.emit();
  }

  exitAddMode(): void {
    this.mode.set('search');
    this.addQuery.set('');
    this.addResults.set([]);
  }

  searchAddCars(term: string): void {
    this.addQuery.set(term);
    const q = term.trim();
    if (!q) {
      this.addResults.set([]);
      return;
    }
    this.addBusy.set(true);

    this.carService
      .searchCars({
        q,
        'finance.enabled': false,
        page: 1,
        limit: 50,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cars }) => {
          const financed = new Set(this.all().map((r) => r.stock));
          const out: AddCandidate[] = [];
          for (const c of cars) {
            if (financed.has(c.stockNo)) continue;
            const f = (c as unknown as { finance?: FinanceRecord }).finance;
            if (f?.enabled) continue;
            out.push({
              id: c.id,
              stock: c.stockNo,
              name: `${this.titleCase(c.make)} ${this.titleCase(c.model)} ${c.year}`,
              km: c.mileage,
              price: c.price,
              pickup: (c.body ?? '').toLowerCase().includes('pick'),
              bank: this.activePartners()[0]?.bank ?? 'Stanbic Bank',
            });
          }
          this.addResults.set(out);
          this.addBusy.set(false);
        },
        error: () => {
          this.notice.set('Search failed. Please try again.');
          this.addBusy.set(false);
        },
      });
  }

  setCandidateBank(stock: string, bank: string): void {
    this.addResults.update((l) => l.map((c) => (c.stock === stock ? { ...c, bank } : c)));
  }

  addCandidate(c: AddCandidate): void {
    const partner = this.partnerFor(c.bank);
    const row: FinanceRow = {
      id: c.id,
      stock: c.stock,
      name: c.name,
      make: '',
      model: '',
      year: new Date().getFullYear(),
      mileage: c.km,
      km: c.km,
      price: c.price,
      bank: c.bank,
      banks: [c.bank],
      rate: partner?.defaults.rate ?? 14,
      deposit: partner?.defaults.deposit ?? 20,
      term: partner?.defaults.term ?? 60,
      pending: 0,
      active: true,
      pickup: c.pickup,
    };
    this.commit([...this.all(), row]);
    this.addResults.update((l) => l.filter((x) => x.stock !== c.stock));
    this.persist(c.id, {
      enabled: true,
      banks: [c.bank],
      primaryBank: c.bank,
      pending: 0,
      active: true,
    });
  }

  toggleSel(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleActive(stock: string): void {
    const row = this.all().find((r) => r.stock === stock);
    if (!row) return;
    const next = !row.active;
    this.commit(this.all().map((r) => (r.stock === stock ? { ...r, active: next } : r)));
    this.persist(row.id, this.fullFinance(row, { active: next }));
  }

  remove(stock: string): void {
    const row = this.all().find((r) => r.stock === stock);
    if (!row) return;
    this.commit(this.all().filter((r) => r.stock !== stock));
    this.selected.update((s) => {
      const n = new Set(s);
      n.delete(stock);
      return n;
    });
    this.persist(row.id, CLEARED_FINANCE);
  }

  dropBank(stock: string, bank: string): void {
    const row = this.all().find((r) => r.stock === stock);
    if (!row || row.bank === bank || row.banks.length < 2) return;
    const next: FinanceRow = { ...row, banks: row.banks.filter((b) => b !== bank) };
    this.commit(this.all().map((r) => (r.stock === stock ? next : r)));
    if (this.detailsRow()?.stock === stock) this.detailsRow.set(next);
    this.persist(row.id, this.fullFinance(next));
  }

  togglePartnerMenu(e: Event): void {
    e.stopPropagation();
    this.partnerMenu.update((v) => !v);
  }

  changePartner(bank: string): void {
    const sel = this.selected();
    const partner = this.partnerFor(bank);
    const next = this.all().map((r) => {
      if (!sel.has(r.stock)) return r;
      const secondary = r.banks.filter((b) => b !== r.bank && b !== bank);
      return {
        ...r,
        bank,
        banks: [bank, ...secondary],
        rate: partner?.defaults.rate ?? r.rate,
        deposit: partner?.defaults.deposit ?? r.deposit,
        term: partner?.defaults.term ?? r.term,
      };
    });
    this.commit(next);
    next.filter((r) => sel.has(r.stock)).forEach((r) => this.persist(r.id, this.fullFinance(r)));
    this.partnerMenu.set(false);
  }

  bulkPause(): void {
    const sel = this.selected();
    const resume = this.allSelectedPaused();
    const next = this.all().map((r) => (sel.has(r.stock) ? { ...r, active: resume } : r));
    this.commit(next);
    next.filter((r) => sel.has(r.stock)).forEach((r) => this.persist(r.id, this.fullFinance(r, { active: resume })));
  }

  bulkRemove(): void {
    const sel = this.selected();
    const removed = this.all().filter((r) => sel.has(r.stock));
    this.commit(this.all().filter((r) => !sel.has(r.stock)));
    this.selected.set(new Set());
    removed.forEach((r) => this.persist(r.id, CLEARED_FINANCE));
  }

  openEdit(): void {
    const stocks = [...this.selected()];
    if (!stocks.length) return;
    const first = this.all().find((r) => r.stock === stocks[0]);
    if (first) {
      this.editForm.set({
        rate: first.rate,
        deposit: first.deposit,
        term: first.term,
        note: first.note ?? '',
      });
    }
    this.editStocks.set(stocks);
    this.editOpen.set(true);
  }

  setEditField(key: 'rate' | 'deposit' | 'term', value: number): void {
    this.editForm.update((f) => ({ ...f, [key]: value }));
  }

  setEditNote(value: string): void {
    this.editForm.update((f) => ({ ...f, note: value }));
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editStocks.set([]);
  }

  saveEdit(): void {
    const form = this.editForm();
    const note = form.note.trim();
    const targets = this.all().filter((r) => this.editStocks().includes(r.stock));
    if (!targets.length) {
      this.closeEdit();
      return;
    }
    this.commit(
      this.all().map((r) =>
        this.editStocks().includes(r.stock)
          ? {
              ...r,
              rate: form.rate,
              deposit: form.deposit,
              term: form.term,
              note: note || undefined,
            }
          : r,
      ),
    );
    forkJoin(
      targets.map((r) =>
        this.carService.updateCar({
          id: r.id,
          finance: this.fullFinance(r, {
            overrides: {
              rate: form.rate,
              deposit: form.deposit,
              term: form.term,
              note: note || undefined,
            },
          }),
        }),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.closeEdit(),
        error: () => {
          this.notice.set('Could not save financing terms. Please try again.');
          this.closeEdit();
        },
      });
  }

  openDetails(row: FinanceRow, e?: Event): void {
    e?.stopPropagation();
    this.detailsRow.set(row);
    this.detailsOpen.set(true);
  }

  closeDetails(): void {
    this.detailsOpen.set(false);
    this.detailsRow.set(null);
  }

  refresh(): void {
    this.load();
  }
}