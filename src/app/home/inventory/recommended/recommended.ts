import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, forkJoin } from 'rxjs';
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
  /** Recommendation score: weighted count of reasons this car qualifies for. */
  score: number;
  record: CarRecord; // full backend record, used by the details popup
}

interface Chip { key: string; label: string; group: 'status' | 'type'; }

interface Reason { tag: string; tone: string; note: string; }

interface Suggestion {
  stock: string;
  tag: string;
  tone: string;
  note: string;
  car: Car;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

/** Weight per reason tag — higher = stronger recommendation signal. */
const REASON_WEIGHT: Record<string, number> = {
  'SELLING FAST': 3,
  'HIGH MARGIN': 3,
  'AGING STOCK': 2,
  'NEW ARRIVAL': 2,
  'GOOD MARGIN': 1,
  'ENQUIRIES': 1,
};

@Component({
  selector: 'app-recommended',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './recommended.html',
  styleUrls: ['./recommended.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommended implements OnInit {
  @Output() published = new EventEmitter<string[]>();
  @Output() previewRequested = new EventEmitter<string[]>();
  @Output() historyRequested = new EventEmitter<void>();
  @Output() editCar = new EventEmitter<string>();

  @ViewChild('search') private searchInput!: ElementRef<HTMLInputElement>;

  private readonly carService = inject(CarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /**
   * Last-saved server state per stock no. `recommended` is what the DB
   * currently has; `status` is the last-synced availability.
   *
   * `recommended` is written immediately on feature/unfeature (no publish
   * step), so `original.recommended` is kept in sync right after each write.
   * `status` still goes through the Publish button.
   */
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
    { key: 'featured', label: 'Recommended', group: 'status' },
    { key: 'SUV', label: 'SUVs', group: 'type' },
    { key: 'Sedan', label: 'Sedans', group: 'type' },
    { key: 'Hatchback', label: 'Hatchbacks', group: 'type' },
    { key: 'Pickup', label: 'Pickups', group: 'type' },
    { key: 'aging', label: 'Aging 60d+', group: 'type' },
  ];

  readonly sortOptions = [
    { key: 'newest', label: 'Newest' },
    { key: 'recommended', label: 'Most recommended' },
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
  /**
   * Cars currently in the Recommended panel. Hydrated from the backend's
   * `recommended: true` flag on load so published recommendations survive a
   * reload. If the DB has no recommended cars, this starts empty — there are
   * no pre-seeded / default featured slots.
   */
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

  ngOnInit(): void {
    // Angular reuses the component instance when the user navigates away and
    // back, so the constructor (and its `load()`) won't run again. Reload
    // whenever the router ends a navigation that lands on this view so the
    // Recommended panel always reflects the latest server state.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        if (this.isRecommendedRoute(e.urlAfterRedirects) && !this.publishing()) {
          this.load();
        }
      });
  }

  private isRecommendedRoute(url: string): boolean {
    return /(^|\/)recommended(\/|$|\?|#)/.test(url);
  }

  /* ---------- public refresh API ---------- */
  /**
   * Public API so a parent can force a refresh (e.g. after editing a car,
   * after a publish elsewhere, or on demand). Safe to call at any time;
   * it simply re-fetches the first page of cars and re-hydrates state.
   */
  refresh(): void {
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
          // Second pass: score depends on the fully-built view-model.
          view.forEach((v) => (v.score = this.score(v)));
          this.cars.set(view);
          this.serverPages.set(pagination.pages);

          // Only cars the DB already marks as recommended. If none, the
          // Recommended panel starts completely empty (no defaults).
          // Drop phantom IDs (cars that no longer exist server-side).
          const validStocks = new Set(cars.map((c) => c.stockNo));
          const savedRecommended = cars
            .filter((c) => c.recommended === true && validStocks.has(c.stockNo))
            .slice(0, this.maxSlots)
            .map((c) => c.stockNo);
          this.featuredIds.set(savedRecommended);

          // Baseline. `recommended` mirrors the DB; status too.
          this.original = new Map(
            cars.map((c, i) => [c.stockNo, { recommended: c.recommended === true, status: view[i].status }]),
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
      score: 0, // filled in by the caller after the view-model is built
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
      recommended: (c) => c.score,
      price: (c) => c.price,
      margin: (c) => c.margin,
      enq: (c) => c.enq,
      lot: (c) => c.onLot,
    };
    return [...list].sort((a, b) => pick[s](b) - pick[s](a));
  });

  /**
   * Candidate pool for the ✦ SUGGESTED TO FEATURE section.
   * Every car is scored by ALL the reasons it qualifies for (weighted), so a
   * car that is new AND high-margin AND selling fast outranks a car with a
   * single reason. Sorted descending: index 0 = most recommended (leftmost).
   * Cars already in the Recommended panel are excluded.
   */
  suggested = computed<Suggestion[]>(() => {
    const feat = new Set(this.featuredIds());
    const pool = this.cars().filter((c) => !feat.has(c.stock));
    if (!pool.length) return [];

    const scored = pool
      .map((car) => ({ car, list: this.reasons(car), score: car.score }))
      .filter((x) => x.list.length > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;             // most reasons first
        if (b.car.margin !== a.car.margin) return b.car.margin - a.car.margin;
        if (b.car.enq !== a.car.enq) return b.car.enq - a.car.enq;
        if (a.car.onLot !== b.car.onLot) return a.car.onLot - b.car.onLot;
        return a.car.stock.localeCompare(b.car.stock);                // final stable tie-break
      });

    return scored.slice(0, 4).map(({ car, list }) => {
      const p = this.primaryReason(car);
      return {
        stock: car.stock,
        tag: list.length > 1 ? `${p.tag} · ${list.length} REASONS` : p.tag,
        tone: p.tone,
        note: list.map((r) => r.note).join(' · '),
        car,
      };
    });
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

  /* ---------- recommendation reasons ---------- */
  /**
   * ALL reasons a car is worth recommending. A car can qualify on multiple
   * grounds (e.g. new arrival + high margin + selling fast); each is listed.
   */
  reasons(c: Car): Reason[] {
    const list: Reason[] = [];

    if (c.enq >= 3) {
      list.push({ tag: 'SELLING FAST', tone: 'blue', note: `${c.enq} enquiries this week` });
    } else if (c.enq > 0) {
      list.push({ tag: 'ENQUIRIES', tone: 'blue', note: `${c.enq} enquiries` });
    }

    if (c.onLot >= 60) {
      list.push({ tag: 'AGING STOCK', tone: 'amber', note: `${c.onLot} days on lot — feature to move it` });
    }

    if (c.margin >= 14) {
      list.push({ tag: 'HIGH MARGIN', tone: 'green', note: `Margin ${c.margin}%` });
    } else if (c.margin >= 10) {
      list.push({ tag: 'GOOD MARGIN', tone: 'green', note: `Margin ${c.margin}%` });
    }

    if (c.onLot <= 7) {
      list.push({ tag: 'NEW ARRIVAL', tone: 'blue', note: this.addedNote(c.onLot) });
    }

    return list;
  }

  /** Weighted recommendation score — more (and stronger) reasons = higher. */
  private score(c: Car): number {
    return this.reasons(c).reduce((n, r) => n + (REASON_WEIGHT[r.tag] ?? 1), 0);
  }

  /**
   * Primary tag shown on cards / the modal header. The highest-weight reason
   * wins; falls back to a neutral "IN STOCK" tag when none apply.
   */
  primaryReason(c: Car): Reason {
    const list = this.reasons(c);
    if (!list.length) return { tag: 'IN STOCK', tone: 'blue', note: 'Available now and ready for viewing' };
    return [...list].sort(
      (a, b) => (REASON_WEIGHT[b.tag] ?? 1) - (REASON_WEIGHT[a.tag] ?? 1)
    )[0];
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

  /**
   * Reload when the browser window regains focus (e.g. the user edited cars in
   * another tab). Skipped while a publish is in flight to avoid clobbering UI.
   */
  @HostListener('window:focus')
  onWindowFocus(): void {
    if (!this.publishing()) {
      this.load();
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

  /* ---------- featuring (immediate DB persistence) ---------- */
  /**
   * Adds a car to the Recommended panel and immediately writes
   * `recommended: true` to the DB. Rolls back the panel state if the write
   * fails. There is no Publish step for the recommended flag.
   */
  feature(id: string): void {
    const ids = this.featuredIds();
    if (ids.includes(id)) return;
    if (ids.length >= this.maxSlots) {
      this.notice.set('All 6 slots are in use. Remove a car first.');
      return;
    }
    const car = this.cars().find((c) => c.stock === id);
    if (!car) return;

    this.touch();
    this.featuredIds.set([...ids, id]);
    this.persistRecommended(car, true);
  }

  /**
   * Removes a car from the Recommended panel and immediately writes
   * `recommended: false` to the DB. Rolls back if the write fails.
   */
  unfeature(id: string): void {
    const car = this.cars().find((c) => c.stock === id);
    this.touch();
    this.featuredIds.update((l) => l.filter((x) => x !== id));
    if (car) this.persistRecommended(car, false);
  }

  toggleFeature(id: string): void {
    this.isFeatured(id) ? this.unfeature(id) : this.feature(id);
  }

  bulkFeature(): void {
    [...this.selected()].forEach((id) => this.feature(id));
  }

  bulkUnfeature(): void {
    [...this.selected()].forEach((id) => this.unfeature(id));
  }

  /**
   * Writes the `recommended` flag straight to the DB. Called by feature /
   * unfeature / drag reorder so the DB mirrors the right panel immediately.
   * Syncs `original` on success and restores the in-memory state on failure.
   */
  private persistRecommended(car: Car, recommended: boolean): void {
    this.carService
      .updateCar({
        id: car.id,
        _id: car.id,
        stockNo: car.stock,
        recommended,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const o = this.original.get(car.stock);
          if (o) this.original.set(car.stock, { ...o, recommended });
        },
        error: (err: { status?: number; error?: { message?: string; error?: string } }) => {
          // Roll back the in-memory panel so it matches the DB again.
          if (recommended) {
            this.featuredIds.update((l) => l.filter((x) => x !== car.stock));
          } else if (!this.featuredIds().includes(car.stock)) {
            this.featuredIds.update((l) => [...l, car.stock]);
          }
          console.error('Recommended update failed', err);
          const detail = err?.error?.message ?? err?.error?.error ?? '';
          const code = err?.status ? ` (HTTP ${err.status})` : '';
          this.notice.set(`Could not update the recommended flag${code}${detail ? ': ' + detail : ''}`);
        },
      });
  }

  /* ---------- status ---------- */
  /** Bulk action: mark every selected car as Reserved. */
  markReserved(): void {
    this.setStatus([...this.selected()], 'Reserved');
  }

  /** Bulk action: mark every selected car back as In stock. */
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
    const header = ['Stock', 'Name', 'Price (KES)', 'Margin %', 'Enquiries', 'Days on lot', 'Status', 'Score'];
    const lines = this.cars()
      .filter((c) => sel.has(c.stock))
      .map((c) => [c.stock, c.name, c.price, c.margin, c.enq, c.onLot, c.status, c.score]);
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
  /**
   * Reorders the Recommended panel. Order is a client-side concern only —
   * the DB stores a boolean, not a rank — so nothing is persisted here.
   */
  drop(to: number): void {
    const from = this.dragFrom();
    this.dragFrom.set(null);
    if (from === null || from === to) return;
    const ids = [...this.featuredIds()];
    const [moved] = ids.splice(from, 1);
    ids.splice(Math.min(to, ids.length), 0, moved);
    this.featuredIds.set(ids);
  }

  /* ---------- publish (status only — recommended is written inline) ---------- */
  /**
   * Publish now only handles availability status. The `recommended` flag is
   * written to the DB the moment a car enters or leaves the Recommended
   * panel (see persistRecommended), so there is nothing recommended-related
   * to send here.
   */
  publish(): void {
    if (this.publishing()) return;

    const changed = this.cars().filter((c) => {
      const o = this.original.get(c.stock);
      return !!o && o.status !== c.status;
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
          availabilityStatus: c.status === 'Reserved' ? 'reserved' : 'inStock',
        }),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          changed.forEach((c) => {
            const o = this.original.get(c.stock);
            if (o) this.original.set(c.stock, { ...o, status: c.status });
          });
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