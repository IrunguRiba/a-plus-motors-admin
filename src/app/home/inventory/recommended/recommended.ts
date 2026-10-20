import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';

type Body = 'SUV' | 'Sedan' | 'Hatchback' | 'Pickup';
type Status = 'In stock' | 'Reserved';

interface Car {
  stock: string;
  name: string;
  body: Body;
  km: number;
  price: number;
  margin: number;
  enq: number;
  onLot: number;
  status: Status;
}

interface Chip { key: string; label: string; group: 'status' | 'type'; }

@Component({
  selector: 'app-recommended',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './recommended.html',
  styleUrls: ['./recommended.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommended {
  @Output() published = new EventEmitter<string[]>();
  @Output() previewRequested = new EventEmitter<string[]>();
  @Output() historyRequested = new EventEmitter<void>();
  @Output() editCar = new EventEmitter<string>();

  @ViewChild('search') private searchInput!: ElementRef<HTMLInputElement>;

  /* ---------- static ---------- */
  readonly total = 42;
  readonly maxSlots = 6;
  readonly emptySet = new Set<string>();
  readonly pages: (number | string)[] = [1, 2, 3, '…', 6];
  readonly marginOptions = [0, 10, 12, 14];
  readonly lotOptions = [0, 30, 60];

  readonly filters: Chip[] = [
    { key: 'all', label: 'All cars · 42', group: 'status' },
    { key: 'stock', label: 'In stock · 36', group: 'status' },
    { key: 'reserved', label: 'Reserved · 4', group: 'status' },
    { key: 'featured', label: 'Featured', group: 'status' },
    { key: 'SUV', label: 'SUVs', group: 'type' },
    { key: 'Sedan', label: 'Sedans', group: 'type' },
    { key: 'Hatchback', label: 'Hatchbacks', group: 'type' },
    { key: 'Pickup', label: 'Pickups', group: 'type' },
    { key: 'aging', label: 'Aging 60d+', group: 'type' },
  ];

  readonly sortOptions = [
    { key: 'newest', label: 'Newest' },
    { key: 'price', label: 'Price' },
    { key: 'margin', label: 'Margin' },
    { key: 'enq', label: 'Enquiries' },
    { key: 'lot', label: 'Days on lot' },
  ];

  readonly featStats = [
    { value: '1,284', label: 'views' },
    { value: '37', label: 'enquiries' },
    { value: '9', label: 'test drives' },
  ];

  private readonly suggestionMeta = [
    { stock: 'AP-0243', tag: 'SELLING FAST', tone: 'blue', note: '5 enquiries this week' },
    { stock: 'AP-0219', tag: 'AGING STOCK', tone: 'amber', note: '62 days on lot' },
    { stock: 'AP-0238', tag: 'TRENDING SEARCH', tone: 'green', note: '"Harrier" +40%' },
    { stock: 'AP-0214', tag: 'HIGH MARGIN', tone: 'green', note: 'Margin 15.4%' },
  ];

  /* ---------- state ---------- */
  cars = signal<Car[]>([
    { stock: 'AP-0243', name: 'Toyota Harrier 2021', body: 'SUV', km: 42000, price: 4250000, margin: 14.4, enq: 5, onLot: 12, status: 'In stock' },
    { stock: 'AP-0238', name: 'Mazda CX-5 2020', body: 'SUV', km: 58000, price: 3650000, margin: 11.8, enq: 3, onLot: 34, status: 'In stock' },
    { stock: 'AP-0231', name: 'Subaru Forester 2019', body: 'SUV', km: 71000, price: 2980000, margin: 12.5, enq: 4, onLot: 21, status: 'Reserved' },
    { stock: 'AP-0227', name: 'Honda Fit 2018', body: 'Hatchback', km: 64000, price: 1450000, margin: 9.6, enq: 2, onLot: 48, status: 'In stock' },
    { stock: 'AP-0219', name: 'Toyota Hilux 2020', body: 'Pickup', km: 55000, price: 4800000, margin: 13.1, enq: 1, onLot: 62, status: 'In stock' },
    { stock: 'AP-0214', name: 'Mercedes C200 2019', body: 'Sedan', km: 49000, price: 5200000, margin: 15.4, enq: 6, onLot: 15, status: 'In stock' },
    { stock: 'AP-0209', name: 'Nissan X-Trail 2018', body: 'SUV', km: 83000, price: 2750000, margin: 8.9, enq: 0, onLot: 70, status: 'In stock' },
  ]);

  featuredIds = signal<string[]>(['AP-0243', 'AP-0238', 'AP-0231', 'AP-0227']);
  selected = signal<Set<string>>(new Set(['AP-0238', 'AP-0219']));

  query = signal('');
  filter = signal('all');
  sort = signal('newest');
  minMargin = signal(0);
  minLot = signal(0);
  filtersOpen = signal(false);
  menuFor = signal<string | null>(null);
  page = signal(1);

  dragFrom = signal<number | null>(null);
  notice = signal('');
  lastEdited = signal('today 17:05');

  /* ---------- derived ---------- */
  selectedCount = computed(() => this.selected().size);
  sortLabel = computed(() => this.sortOptions.find((o) => o.key === this.sort())?.label ?? 'Newest');

  rows = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    const feat = new Set(this.featuredIds());
    const list = this.cars().filter((c) => {
      switch (f) {
        case 'all': break;
        case 'stock': if (c.status !== 'In stock') return false; break;
        case 'reserved': if (c.status !== 'Reserved') return false; break;
        case 'featured': if (!feat.has(c.stock)) return false; break;
        case 'aging': if (c.onLot < 60) return false; break;
        default: if (c.body !== f) return false;
      }
      if (c.margin < this.minMargin() || c.onLot < this.minLot()) return false;
      return !q || `${c.name} ${c.stock} ${c.body}`.toLowerCase().includes(q);
    });

    const s = this.sort();
    if (s === 'newest') return list;
    const pick: Record<string, (c: Car) => number> = {
      price: (c) => c.price, margin: (c) => c.margin, enq: (c) => c.enq, lot: (c) => c.onLot,
    };
    return [...list].sort((a, b) => pick[s](b) - pick[s](a));
  });

  suggested = computed(() =>
    this.suggestionMeta
      .map((m) => ({ ...m, car: this.cars().find((c) => c.stock === m.stock)! }))
      .filter((m) => !!m.car)
  );

  featuredCars = computed(() =>
    this.featuredIds()
      .map((id) => this.cars().find((c) => c.stock === id))
      .filter((c): c is Car => !!c)
  );
  slotList = computed<(Car | null)[]>(() =>
    Array.from({ length: this.maxSlots }, (_, i) => this.featuredCars()[i] ?? null)
  );
  firstEmpty = computed(() => this.featuredCars().length);

  /* ---------- helpers ---------- */
  val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }
  fmt(n: number): string {
    return n.toLocaleString('en-US');
  }
  chipLabel(f: Chip): string {
    return f.key === 'featured' ? `Featured · ${this.featuredIds().length}` : f.label;
  }
  isFeatured(id: string): boolean {
    return this.featuredIds().includes(id);
  }

  private touch(): void {
    this.notice.set('');
  }

  /* ---------- global keys / click-away ---------- */
  @HostListener('document:click')
  closePopovers(): void {
    this.filtersOpen.set(false);
    this.menuFor.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
    if (e.key === 'Escape') this.closePopovers();
  }

  /* ---------- filters ---------- */
  toggleFilters(e: Event): void {
    e.stopPropagation();
    this.menuFor.set(null);
    this.filtersOpen.update((v) => !v);
  }
  resetFilters(): void {
    this.minMargin.set(0);
    this.minLot.set(0);
    this.filter.set('all');
    this.query.set('');
  }

  /* ---------- selection ---------- */
  toggleSel(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ---------- featuring ---------- */
  feature(id: string): void {
    const ids = this.featuredIds();
    if (ids.includes(id)) return;
    if (ids.length >= this.maxSlots) {
      this.notice.set('All 6 slots are in use. Remove a car first.');
      return;
    }
    this.touch();
    this.featuredIds.set([...ids, id]);
  }

  unfeature(id: string): void {
    this.touch();
    this.featuredIds.update((l) => l.filter((x) => x !== id));
  }

  toggleFeature(id: string): void {
    this.isFeatured(id) ? this.unfeature(id) : this.feature(id);
  }

  bulkFeature(): void {
    [...this.selected()].forEach((id) => this.feature(id));
  }

  bulkUnfeature(): void {
    const sel = this.selected();
    this.touch();
    this.featuredIds.update((l) => l.filter((x) => !sel.has(x)));
  }

  /* ---------- status ---------- */
  markReserved(): void {
    const sel = this.selected();
    this.cars.update((l) => l.map((c) => (sel.has(c.stock) ? { ...c, status: 'Reserved' as Status } : c)));
  }

  toggleReserved(id: string): void {
    this.cars.update((l) =>
      l.map((c) => (c.stock === id ? { ...c, status: (c.status === 'Reserved' ? 'In stock' : 'Reserved') as Status } : c))
    );
    this.menuFor.set(null);
  }

  toggleRowMenu(id: string, e: Event): void {
    e.stopPropagation();
    this.filtersOpen.set(false);
    this.menuFor.update((cur) => (cur === id ? null : id));
  }

  /* ---------- export ---------- */
  exportCsv(): void {
    const sel = this.selected();
    const header = ['Stock', 'Name', 'Price (KES)', 'Margin %', 'Enquiries', 'Days on lot', 'Status'];
    const lines = this.cars()
      .filter((c) => sel.has(c.stock))
      .map((c) => [c.stock, c.name, c.price, c.margin, c.enq, c.onLot, c.status]);
    const csv = [header, ...lines]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recommended-cars.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- drag to reorder ---------- */
  drop(to: number): void {
    const from = this.dragFrom();
    this.dragFrom.set(null);
    if (from === null || from === to) return;
    const ids = [...this.featuredIds()];
    const [moved] = ids.splice(from, 1);
    ids.splice(Math.min(to, ids.length), 0, moved);
    this.featuredIds.set(ids);
  }

  /* ---------- publish ---------- */
  publish(): void {
    this.lastEdited.set(
      'today ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    );
    this.published.emit(this.featuredIds());
  }
}