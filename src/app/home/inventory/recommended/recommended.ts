import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CarService } from '../../../car-service';
import { CarRecord } from '../../../interfaces/car-interface';

type Status = 'In stock' | 'Reserved';

/** View-model used by the template (same shape as before, plus `id`). */
interface Car {
  id: string;
  stock: string;
  name: string;
  body: string;
  km: number;
  price: number;
  margin: number;
  enq: number;
  onLot: number;
  status: Status;
  image: string | null;
  record: CarRecord; // full backend record, used by the details popup
}

interface Chip { key: string; label: string; group: 'status' | 'type'; }

interface Suggestion {
  stock: string;
  tag: string;
  tone: string;
  note: string;
  car: Car;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

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

  private readonly carService = inject(CarService);
  private readonly destroyRef = inject(DestroyRef);

  /** Last-saved server state per stock no, used to work out what changed on publish. */
  private original = new Map<string, { recommended: boolean; status: Status }>();

  /* ---------- static ---------- */
  readonly maxSlots = 6;
  readonly emptySet = new Set<string>();
  readonly marginOptions = [0, 10, 12, 14];
  readonly lotOptions = [0, 30, 60];

  // Counts are filled in by chipLabel() from live data.
  readonly filters: Chip[] = [
    { key: 'all', label: 'All cars', group: 'status' },
    { key: 'stock', label: 'In stock', group: 'status' },
    { key: 'reserved', label: 'Reserved', group: 'status' },
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

  // No backend source for these yet.
  readonly featStats = [
    { value: '—', label: 'views' },
    { value: '—', label: 'enquiries' },
    { value: '—', label: 'test drives' },
  ];

  /* ---------- state ---------- */
  cars = signal<Car[]>([]);
  featuredIds = signal<string[]>([]);
  selected = signal<Set<string>>(new Set());

  loading = signal(false);
  publishing = signal(false);
  serverPages = signal(1);

  query = signal('');
  filter = signal('all');
  sort = signal('newest');
  minMargin = signal(0);
  minLot = signal(0);
  filtersOpen = signal(false);
  menuFor = signal<string | null>(null);
  page = signal(1);

  /** Car details popup */
  detailsFor = signal<string | null>(null);
  /** Which section the opened car came from. */
  detailsFrom = signal<'suggested' | 'list' | null>(null);

  dragFrom = signal<number | null>(null);
  notice = signal('');
  lastEdited = signal('—');

  constructor() {
    this.load();
  }

  /* ---------- backend ---------- */
  load(): void {
    this.loading.set(true);
    this.carService
      .searchCars({ page: 1, limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cars, pagination }) => {
          const view = cars.map((c) => this.toView(c));
          this.cars.set(view);
          this.serverPages.set(pagination.pages);

          // Backend `recommended` flag drives the featured slots.
          this.featuredIds.set(
            cars.filter((c) => c.recommended).slice(0, this.maxSlots).map((c) => c.stockNo),
          );

          this.original = new Map(
            cars.map((c, i) => [c.stockNo, { recommended: c.recommended, status: view[i].status }]),
          );

          const latest = cars
            .filter((c) => c.recommended && c.updatedAt)
            .map((c) => new Date(c.updatedAt as string).getTime())
            .sort((a, b) => b - a)[0];
          if (latest) this.lastEdited.set(this.stamp(new Date(latest)));

          this.notice.set('');
          this.loading.set(false);
        },
        error: () => {
          this.notice.set('Could not load cars. Please try again.');
          this.loading.set(false);
        },
      });
  }

  private toView(c: CarRecord): Car {
    const margin = c.price > 0 ? ((c.price - c.cost) / c.price) * 100 : 0;
    const created = c.createdAt ? new Date(c.createdAt).getTime() : Date.now();
    const body = (c.body ?? '').trim();
    return {
      id: c.id,
      stock: c.stockNo,
      name: `${titleCase(c.make)} ${titleCase(c.model)} ${c.year}`.trim(),
      body: !body ? 'Other' : body.length <= 3 ? body.toUpperCase() : titleCase(body),
      km: c.mileage,
      price: c.price,
      margin: Math.round(margin * 10) / 10,
      enq: 0, // no enquiries data on the car record yet
      onLot: Math.max(0, Math.floor((Date.now() - created) / 86_400_000)),
      status: c.availabilityStatus === 'reserved' ? 'Reserved' : 'In stock',
      image: this.firstImage(c),
      record: c,
    };
  }

  /**
   * Picks the first available image from a car record.
   * Handles common backend shapes: `images: string[]`, `photos: string[]`,
   * `image: string`, and `images: { url: string }[]`.
   */
  private firstImage(c: CarRecord): string | null {
    const rec = c as unknown as {
      images?: unknown;
      photos?: unknown;
      image?: unknown;
      thumbnail?: unknown;
    };
    const fromArray = (v: unknown): string | null => {
      if (!Array.isArray(v) || !v.length) return null;
      const first = v[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        const o = first as { url?: unknown; src?: unknown; path?: unknown };
        if (typeof o.url === 'string') return o.url;
        if (typeof o.src === 'string') return o.src;
        if (typeof o.path === 'string') return o.path;
      }
      return null;
    };
    const asString = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
    return (
      fromArray(rec.images) ??
      fromArray(rec.photos) ??
      asString(rec.image) ??
      asString(rec.thumbnail)
    );
  }

  private stamp(d: Date): string {
    const same = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return same ? `today ${time}` : `${d.toLocaleDateString('en-GB')} ${time}`;
  }

  /* ---------- derived ---------- */
  get total(): number {
    return this.cars().length;
  }

  get pages(): (number | string)[] {
    const n = this.serverPages();
    if (n <= 5) return Array.from({ length: n }, (_, i) => i + 1);
    return [1, 2, 3, '…', n];
  }

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
    if (s === 'newest') return [...list].sort((a, b) => a.onLot - b.onLot);
    const pick: Record<string, (c: Car) => number> = {
      price: (c) => c.price, margin: (c) => c.margin, enq: (c) => c.enq, lot: (c) => c.onLot,
    };
    return [...list].sort((a, b) => pick[s](b) - pick[s](a));
  });

  /** Suggestions derived from live data (non-featured cars only). */
  suggested = computed<Suggestion[]>(() => {
    const feat = new Set(this.featuredIds());
    const pool = this.cars().filter((c) => !feat.has(c.stock));
    if (!pool.length) return [];

    const used = new Set<string>();
    const out: Suggestion[] = [];
    const best = (fn: (c: Car) => number) => [...pool].sort((a, b) => fn(b) - fn(a))[0];
    const add = (car: Car | undefined, tag: string, tone: string, note: string) => {
      if (!car || used.has(car.stock)) return;
      used.add(car.stock);
      out.push({ stock: car.stock, tag, tone, note, car });
    };

    const hot = best((c) => c.enq);
    if (hot && hot.enq > 0) add(hot, 'SELLING FAST', 'blue', `${hot.enq} enquiries`);

    const aged = best((c) => c.onLot);
    if (aged && aged.onLot >= 60) add(aged, 'AGING STOCK', 'amber', `${aged.onLot} days on lot`);

    const margin = best((c) => c.margin);
    add(margin, 'HIGH MARGIN', 'green', margin ? `Margin ${margin.margin}%` : '');

    const fresh = best((c) => -c.onLot);
    add(fresh, 'NEW ARRIVAL', 'blue', fresh ? this.addedNote(fresh.onLot) : '');

    return out.slice(0, 4);
  });

  /** Car currently shown in the details popup. */
  detail = computed(() => {
    const id = this.detailsFor();
    return id ? (this.cars().find((c) => c.stock === id) ?? null) : null;
  });

  /** True when the modal was opened from the Suggested to Feature section. */
  isSuggestedDetail = computed(() => this.detailsFrom() === 'suggested');

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
    const cars = this.cars();
    switch (f.key) {
      case 'all': return `${f.label} · ${cars.length}`;
      case 'stock': return `${f.label} · ${cars.filter((c) => c.status === 'In stock').length}`;
      case 'reserved': return `${f.label} · ${cars.filter((c) => c.status === 'Reserved').length}`;
      case 'featured': return `${f.label} · ${this.featuredIds().length}`;
      default: return f.label;
    }
  }
  /**
   * Display-only short stock no.
   * Examples:
   *   T-H-4500-1026-004  →  TH1026
   *   AP-0243            →  AP-0243  (already short, returned as-is)
   */
  shortStock(stock: string): string {
    const s = (stock ?? '').trim();
    if (!s) return '';
    const p = s.split('-');
    if (p.length === 2 && p[1].length <= 4) return s;
    return p.length >= 4 ? `${p[0]}${p[1]}${p[3]}` : s;
  }
  isFeatured(id: string): boolean {
    return this.featuredIds().includes(id);
  }
  nameNoYear(name: string): string {
    return name.replace(/\s\d{4}$/, '');
  }
  private addedNote(days: number): string {
    return days === 0 ? 'Added today' : `Added ${days} day${days === 1 ? '' : 's'} ago`;
  }

  /** Why a car is worth recommending (shown in the details popup). */
  reason(c: Car): { tag: string; tone: string; note: string } {
    if (c.enq >= 3) return { tag: 'SELLING FAST', tone: 'blue', note: `${c.enq} enquiries this week` };
    if (c.onLot >= 60) return { tag: 'AGING STOCK', tone: 'amber', note: `${c.onLot} days on lot — feature to move it` };
    if (c.margin >= 14) return { tag: 'HIGH MARGIN', tone: 'green', note: `Margin ${c.margin}%` };
    if (c.onLot <= 7) return { tag: 'NEW ARRIVAL', tone: 'blue', note: this.addedNote(c.onLot) };
    return { tag: 'IN STOCK', tone: 'blue', note: 'Available now and ready for viewing' };
  }

  /* ---------- details popup ---------- */
  openDetails(stock: string, from: 'suggested' | 'list', e?: Event): void {
    e?.stopPropagation();
    this.filtersOpen.set(false);
    this.menuFor.set(null);
    this.detailsFrom.set(from);
    this.detailsFor.set(stock);
  }
  closeDetails(): void {
    this.detailsFor.set(null);
    this.detailsFrom.set(null);
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
    if (e.key === 'Escape') {
      this.closePopovers();
      this.closeDetails();
    }
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
    this.setStatus([...this.selected()], 'Reserved');
  }

  markInStock(): void {
    this.setStatus([...this.selected()], 'In stock');
  }

  toggleReserved(id: string): void {
    const car = this.cars().find((c) => c.stock === id);
    if (car) this.setStatus([id], car.status === 'Reserved' ? 'In stock' : 'Reserved');
    this.menuFor.set(null);
  }

  /**
   * Updates availabilityStatus on the backend straight away.
   * The UI changes immediately and rolls back if the API call fails.
   */
  private setStatus(stocks: string[], status: Status): void {
    const targets = this.cars().filter((c) => stocks.includes(c.stock) && c.status !== status);
    if (!targets.length) return;

    const prev = new Map(targets.map((c) => [c.stock, c.status] as const));
    const apply = (next: (c: Car) => Status) =>
      this.cars.update((l) => l.map((c) => (prev.has(c.stock) ? { ...c, status: next(c) } : c)));

    apply(() => status); // optimistic update
    this.touch();

    forkJoin(
      targets.map((c) =>
        this.carService.updateCar({
          id: c.id,
          _id: c.id,
          stockNo: c.stock,
          availabilityStatus: status === 'Reserved' ? 'reserved' : 'inStock',
        }),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          targets.forEach((c) => {
            const o = this.original.get(c.stock);
            if (o) this.original.set(c.stock, { ...o, status });
          });
        },
        error: (err: { status?: number; error?: { message?: string; error?: string } }) => {
          apply((c) => prev.get(c.stock) as Status); // roll back
          console.error('Status update failed', err);
          const detail = err?.error?.message ?? err?.error?.error ?? '';
          const code = err?.status ? ` (HTTP ${err.status})` : '';
          this.notice.set(`Could not update the car status${code}${detail ? ': ' + detail : ''}`);
        },
      });
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
    if (this.publishing()) return;

    const featured = new Set(this.featuredIds());
    const changed = this.cars().filter((c) => {
      const o = this.original.get(c.stock);
      return !!o && (o.recommended !== featured.has(c.stock) || o.status !== c.status);
    });

    if (!changed.length) {
      this.finishPublish();
      return;
    }

    this.publishing.set(true);
    forkJoin(
      changed.map((c) =>
        this.carService.updateCar({
          id: c.id,
          _id: c.id,
          stockNo: c.stock,
          recommended: featured.has(c.stock),
          availabilityStatus: c.status === 'Reserved' ? 'researved' : 'inStock',
        }),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          changed.forEach((c) =>
            this.original.set(c.stock, { recommended: featured.has(c.stock), status: c.status }),
          );
          this.publishing.set(false);
          this.finishPublish();
        },
        error: () => {
          this.publishing.set(false);
          this.notice.set('Publishing failed. Your changes are still here, so please try again.');
        },
      });
  }

  private finishPublish(): void {
    this.notice.set('');
    this.lastEdited.set(this.stamp(new Date()));
    this.published.emit(this.featuredIds());
  }
}