import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';

import { CarService, DecodedVin } from '../../../car-service';
import { CarRecord, Doc, Notice, Photo } from '../../../interfaces/car-interface';

type Stage = 'draft' | 'review' | 'live';
type Status = 'draft' | 'submitted';
type VinState = 'idle' | 'decoding' | 'populate';
type StockState = 'idle' | 'editing' | 'querying' | 'populate';
type Mode = 'add' | 'edit';

@Component({
  selector: 'app-add-car',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './add-car.html',
  styleUrls: ['./add-car.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCar implements OnDestroy {
  done = 'checkmark.png';
  add = 'plus.png';
  @Output() submitted = new EventEmitter<Record<string, unknown>>();
  @Output() draftSaved = new EventEmitter<Record<string, unknown>>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /* ---------- static option lists ---------- */
  readonly drives = ['2WD', '4WD', 'AWD'];
  readonly transmissions = ['Automatic', 'Manual', 'CVT'];
  readonly fuels = ['Petrol', 'Diesel', 'Hybrid', 'EV'];
  readonly sources = ['Trade-in', 'Direct purchase', 'Auction', 'Consignment', 'Import'];
  readonly branches = ['Main Yard', 'Westlands Yard', 'Mombasa Road Yard'];
  readonly salespeople = ['Mary Wanjiru', 'Brian Otieno', 'Faith Njeri', 'Kevin Mutua'];
  readonly steps: { id: Stage; label: string }[] = [
    { id: 'draft', label: 'DRAFT' },
    { id: 'review', label: 'IN REVIEW' },
    { id: 'live', label: 'LIVE' },
  ];
  readonly maxPhotos = 12;
  readonly photoSlots = Array.from({ length: 12 }, (_, i) => i);

  /* ---------- reactive form ---------- */
  readonly form = this.fb.group({
    make: ['', [Validators.required, Validators.maxLength(60)]],
    model: ['', [Validators.required, Validators.maxLength(80)]],
    year: [
      new Date().getFullYear(),
      [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)],
    ],
    body: [''],
    colour: [''],

    mileage: [0, [Validators.required, Validators.min(0), Validators.max(1000000)]],

    engine: [0, [Validators.required, Validators.min(0), Validators.max(10.0)]],
    drive: ['2WD'],
    transmission: ['Automatic'],
    fuel: ['Petrol'],
    vin: ['', [Validators.maxLength(25)]],
    source: [this.sources[0]],
    branch: [this.branches[0]],
    cost: [0, [Validators.min(0)]],
    price: [0, [Validators.required, Validators.min(1)]],
    negotiable: [false],
    financing: [false],
    notes: [''],
    showOnWeb: [true],
    salesperson: [this.salespeople[0]],
    reviewVideoUrl: [''],
  });

  readonly f = this.form.controls;

  /** Live snapshot of the form as a signal. */
  readonly v = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  /* ---------- extra UI state ---------- */
  readonly bankDraft = new FormControl('', { nonNullable: true });
  readonly banks = signal<string[]>([]);

  readonly features = signal<string[]>([
    'Leather seats',
    'Sunroof',
    'Reverse camera',
    'Apple CarPlay',
    'Keyless entry',
  ]);
  readonly selected = signal(new Set<string>());
  readonly adding = signal(false);

  readonly photos = signal<Photo[]>([]);
  readonly photoUrlDraft = new FormControl('', { nonNullable: true });
  readonly pasteDraft = new FormControl('', { nonNullable: true });
  readonly docs = signal<Doc[]>([
    { label: 'Logbook / ownership', file: null },
    { label: 'Inspection report', file: null },
    { label: 'Valuation certificate', file: null },
    { label: 'Seller ID / KRA PIN', file: null },
  ]);

  readonly stage = signal<Stage>('draft');
  readonly carId = signal<string | null>(null);
  readonly stockNo = signal('');
  readonly savedAt = signal('');
  readonly saving = signal(false);
  readonly showErrors = signal(false);
  readonly notice = signal<Notice | null>(null);

  /* ---------- VIN decode state ---------- */
  readonly vinState = signal<VinState>('idle');
  readonly decoded = signal<DecodedVin | null>(null);
  readonly decodeMsg = signal('');

  /* ---------- mode ---------- */
  readonly mode = signal<Mode>('add');

  /* ---------- stock-no lookup (edit mode) ---------- */
  readonly stockState = signal<StockState>('idle');
  readonly stockDraft = new FormControl('', { nonNullable: true });
  readonly stockError = signal('');
  readonly pendingCar = signal<CarRecord | null>(null);

  /* ---------- stock-no preview (add mode, live) ---------- */
  readonly stockPreview = signal('');

  /* ---------- delete (edit mode) ---------- */
  readonly showDeleteModal = signal(false);
  readonly deleteConfirmDraft = new FormControl('', { nonNullable: true });
  readonly deleting = signal(false);

  /**
   * FormControl.value is NOT a signal, so a computed() reading it never
   * re-evaluates while the user types. Bridge the control into a signal.
   * (Must be declared after deleteConfirmDraft.)
   */
  private readonly deleteConfirmText = toSignal(
    this.deleteConfirmDraft.valueChanges.pipe(startWith(this.deleteConfirmDraft.value)),
    { initialValue: '' },
  );

  /** Phrase the user must type to confirm: "delete-<STOCKNO>" */
  readonly deleteConfirmPhrase = computed(() => {
    const stock = this.stockNo().trim().toUpperCase();
    return stock ? `delete-${stock}` : '';
  });

  readonly deleteConfirmValid = computed(() => {
    const typed = this.deleteConfirmText().trim().toLowerCase();
    const phrase = this.deleteConfirmPhrase().toLowerCase();
    return phrase.length > 0 && typed === phrase;
  });
  /** True only when a car is actually loaded in edit mode. */
  readonly canDelete = computed(
    () => this.mode() === 'edit' && !!this.carId() && !!this.stockNo(),
  );

  /* ---------- discard-changes modal ---------- */
  readonly showDiscardModal = signal(false);
  private pendingAction: (() => void) | null = null;

  /* ---------- live timers / refs (cleaned on destroy) ---------- */
  private stockTimer?: ReturnType<typeof setTimeout>;
  private addFeatureTimer?: ReturnType<typeof setTimeout>;

  /** Host element reference — used to scope DOM queries to this component. */
  @ViewChild('host', { static: true, read: ElementRef })
  private hostView?: ElementRef<HTMLElement>;

  /* ---------- derived ---------- */
  readonly margin = computed(() => this.v().price - this.v().cost);
  readonly marginPct = computed(() =>
    this.v().price > 0 ? ((this.margin() / this.v().price) * 100).toFixed(1) : '0.0',
  );
  readonly uploadedCount = computed(() => this.docs().filter((d) => d.file).length);
  readonly slots = computed<(Photo | null)[]>(() =>
    this.photoSlots.map((i) => this.photos()[i] ?? null),
  );
  readonly bankMissing = computed(() => this.v().financing && this.banks().length === 0);

  readonly badgeText = computed(() => {
    const m = this.mode();
    const s = this.stage();
    const saved = this.savedAt();

    if (m === 'edit') {
      if (!this.carId()) return 'EDITING · NO CAR LOADED';
      return saved
        ? `EDITING · ${this.stockNo()} · SAVED ${saved}`
        : `EDITING · ${this.stockNo()}`;
    }
    if (s !== 'draft') return `SUBMITTED · ${saved}`;
    return saved ? `ADDING · SAVED ${saved}` : 'ADDING · NOT SAVED YET';
  });

  readonly vinButtonLabel = computed(() => {
    switch (this.vinState()) {
      case 'decoding':
        return 'DECODING…';
      case 'populate':
        return 'POPULATE';
      default:
        return 'DECODE';
    }
  });

  readonly stockButtonLabel = computed(() => {
    switch (this.stockState()) {
      case 'querying':
        return 'QUERYING…';
      case 'populate':
        return 'POPULATE';
      case 'editing':
        return 'FIND';
      default:
        return 'EDIT VEHICLE DETAILS';
    }
  });

  constructor() {
    // Leak-safe: auto-unsubscribe when the component is destroyed.
    const refresh = () => this.refreshStockPreview();
    this.form.controls.make.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(refresh);
    this.form.controls.model.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(refresh);
    this.form.controls.engine.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(refresh);

    // When entering add mode, kick off a preview once.
    this.refreshStockPreview();
  }

  /* ---------- helpers ---------- */
  fmt(n: number): string {
    return n ? n.toLocaleString('en-US') : '';
  }

  num(ctrl: FormControl<number>, e: Event, group = true, max = 12): void {
    const el = e.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').slice(0, max);
    const n = digits ? Number(digits) : 0;
    ctrl.setValue(n);
    ctrl.markAsDirty();
    el.value = group ? this.fmt(n) : digits;
  }

  bad(c: AbstractControl): boolean {
    return this.showErrors() && c.invalid;
  }

  private now(): string {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  sectionOk(keys: (keyof typeof this.f)[]): boolean {
    return keys.every((k) => this.f[k].valid);
  }

  /* ---------- coercion helpers ---------- */

  private toNum(x: unknown, fallback = 0): number {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    if (typeof x === 'string') {
      const cleaned = x.replace(/[^0-9.\-]/g, '');
      const n = cleaned ? Number(cleaned) : NaN;
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  }

  private toStr(x: unknown, fallback = ''): string {
    return typeof x === 'string' ? x : x == null ? fallback : String(x);
  }

  private toBool(x: unknown, fallback = false): boolean {
    if (typeof x === 'boolean') return x;
    if (typeof x === 'string') return x.toLowerCase() === 'true' || x === '1';
    if (typeof x === 'number') return x !== 0;
    return fallback;
  }

  private toStringArray(x: unknown): string[] {
    if (Array.isArray(x)) return x.filter((v): v is string => typeof v === 'string');
    if (typeof x === 'string' && x.trim()) {
      try {
        const parsed = JSON.parse(x);
        if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
      } catch {
        /* not JSON — treat as single value */
      }
      return [x];
    }
    return [];
  }

  /* ============================================================
     STOCK NO PREVIEW  (add mode)
     ============================================================ */

  private refreshStockPreview(): void {
    if (this.mode() !== 'add') return;

    clearTimeout(this.stockTimer);
    this.stockTimer = setTimeout(() => {
      this.stockTimer = undefined;

      const { make, model, engine } = this.form.getRawValue();
      if (!make || !model || !engine) {
        this.stockPreview.set('');
        return;
      }

      // takeUntilDestroyed handles in-flight cancellation on destroy.
      this.api
        .generateStockNo(make, model, engine)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (sn) => this.stockPreview.set(sn),
          error: () => this.stockPreview.set(''),
        });
    }, 250);
  }

  /* ============================================================
     MODE SWITCHING
     ============================================================ */

  private isDirty(): boolean {
    return (
      this.form.dirty ||
      this.photos().length > 0 ||
      this.banks().length > 0 ||
      this.docs().some((d) => d.file) ||
      this.selected().size > 0
    );
  }

  clickAddNew(): void {
    if (this.mode() === 'add') {
      this.resetForm();
      return;
    }
    const proceed = () => this.switchToAdd();
    if (this.isDirty()) {
      this.pendingAction = proceed;
      this.showDiscardModal.set(true);
    } else {
      proceed();
    }
  }

  clickEdit(): void {
    if (this.mode() === 'edit') {
      this.stockState.set('editing');
      return;
    }
    const proceed = () => this.switchToEdit();
    if (this.isDirty()) {
      this.pendingAction = proceed;
      this.showDiscardModal.set(true);
    } else {
      proceed();
    }
  }

  private switchToAdd(): void {
    this.resetForm();
    this.mode.set('add');
    this.stockState.set('idle');
    this.stockDraft.enable();
    this.stockDraft.setValue('');
    this.stockError.set('');
    this.pendingCar.set(null);
    this.refreshStockPreview();
  }

  private switchToEdit(): void {
    this.resetForm();
    this.mode.set('edit');
    this.stockState.set('editing');
    this.stockDraft.enable();
    this.stockDraft.setValue('');
    this.stockError.set('');
    this.pendingCar.set(null);
  }

  confirmDiscard(): void {
    this.showDiscardModal.set(false);
    const fn = this.pendingAction;
    this.pendingAction = null;
    fn?.();
  }

  cancelDiscard(): void {
    this.showDiscardModal.set(false);
    this.pendingAction = null;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  /* ============================================================
     STOCK-NO LOOKUP  (edit mode)
     ============================================================ */

  onStockButton(): void {
    const state = this.stockState();

    if (state === 'populate') {
      this.applyPendingCar();
      return;
    }
    if (state === 'querying') return;

    const stock = this.stockDraft.value.trim().toUpperCase();
    if (!stock) {
      this.stockError.set('Enter a stock number first.');
      return;
    }

    this.stockError.set('');
    this.stockState.set('querying');
    this.stockDraft.disable();

    this.api
      .getCarByStockNo(stock)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          // Guard against a destroyed view (signals are still safe to set,
          // but avoid re-enabling a control the user may have navigated away from).
          try {
            this.stockDraft.enable();
          } catch {
            /* control may be destroyed */
          }
          if (this.stockState() === 'querying') this.stockState.set('editing');
        }),
      )
      .subscribe({
        next: (car) => {
          if (!car || Object.keys(car as object).length === 0) {
            this.stockError.set('No car found with that stock number.');
            return;
          }
          this.pendingCar.set(car);
          this.applyPendingCar();
        },
        error: (err) => {
          console.error('[stock lookup] failed:', err);
          this.stockError.set('Failed. Invalid Stock No. Check your connection and try again.');
        },
      });
  }

  private applyPendingCar(): void {
    const car = this.pendingCar();
    if (!car) {
      this.stockError.set('No car loaded to populate.');
      return;
    }

    try {
      const c = car as unknown as Record<string, unknown>;

      this.form.patchValue({
        make: this.toStr(c['make']),
        model: this.toStr(c['model']),
        year: this.toNum(c['year'], new Date().getFullYear()),
        body: this.toStr(c['body']),
        colour: this.toStr(c['colour']),
        mileage: this.toNum(c['mileage']),
        engine: this.toNum(c['engine']),
        drive: this.toStr(c['drive'], '2WD'),
        transmission: this.toStr(c['transmission'], 'Automatic'),
        fuel: this.toStr(c['fuel'], 'Petrol'),
        vin: this.toStr(c['vin']),
        source: this.toStr(c['source'], this.sources[0]),
        branch: this.toStr(c['branch'], this.branches[0]),
        cost: this.toNum(c['cost']),
        price: this.toNum(c['price']),
        negotiable: this.toBool(c['negotiable']),
        financing: this.toBool(c['financing']),
        notes: this.toStr(c['notes']),
        showOnWeb: this.toBool(c['showOnWeb'], true),
        salesperson: this.toStr(c['salesperson'], this.salespeople[0]),
        reviewVideoUrl: this.toStr(c['reviewVideoUrl']),
      });

      this.form.updateValueAndValidity({ emitEvent: true });
      this.form.markAsPristine();

      const rawPhotos = c['photos'];
      const photoList: Photo[] = Array.isArray(rawPhotos)
        ? (rawPhotos as unknown[])
            .map((p) =>
              typeof p === 'string' ? { url: p } : (p as Photo | null | undefined),
            )
            .filter((p): p is Photo => !!p && typeof p.url === 'string')
        : this.toStringArray(rawPhotos).map((url) => ({ url }));
      this.photos.set(photoList);

      const feat = this.toStringArray(c['features']);
      this.selected.set(new Set(feat));
      this.features.update((list) => {
        const merged = [...list];
        for (const f of feat) if (!merged.includes(f)) merged.push(f);
        return merged;
      });

      this.banks.set(this.toStringArray(c['banks']));

      const rawDocs = c['documents'];
      let docsFromServer: { label: string; fileName: string }[] = [];
      if (Array.isArray(rawDocs)) {
        docsFromServer = (rawDocs as unknown[])
          .map((d) => {
            if (typeof d === 'string') return { label: d, fileName: d };
            if (d && typeof d === 'object') {
              const o = d as Record<string, unknown>;
              return {
                label: this.toStr(o['label']),
                fileName: this.toStr(o['fileName'] ?? o['name'] ?? ''),
              };
            }
            return null;
          })
          .filter(
            (d): d is { label: string; fileName: string } => !!d && !!d.label,
          );
      } else if (typeof rawDocs === 'string') {
        try {
          const parsed = JSON.parse(rawDocs);
          if (Array.isArray(parsed)) {
            docsFromServer = parsed
              .map((d: unknown) => {
                if (typeof d === 'string') return { label: d, fileName: d };
                if (d && typeof d === 'object') {
                  const o = d as Record<string, unknown>;
                  return {
                    label: this.toStr(o['label']),
                    fileName: this.toStr(o['fileName'] ?? o['name'] ?? ''),
                  };
                }
                return null;
              })
              .filter(
                (d: { label: string; fileName: string } | null): d is { label: string; fileName: string } =>
                  !!d && !!d.label,
              );
          }
        } catch {
          /* ignore */
        }
      }

      this.docs.update((list) =>
        list.map((d) => {
          const match = docsFromServer.find((x) => x.label === d.label);
          return match
            ? {
                ...d,
                file: new File([], match.fileName) as File,
                serverName: match.fileName,
              }
            : { ...d, file: null, serverName: undefined };
        }),
      );

      this.carId.set(this.toStr(c['id'] ?? c['_id']) || null);
      const resolvedStock =
        this.toStr(c['stockNo']) || this.stockDraft.value.trim().toUpperCase();
      this.stockNo.set(resolvedStock);
      this.stage.set(c['status'] === 'submitted' ? 'review' : 'draft');
      this.savedAt.set('');

      this.pendingCar.set(null);
      this.stockState.set('editing');
      this.stockDraft.setValue('');
      this.stockError.set('');
      this.stockDraft.enable();

      this.notice.set({
        kind: 'ok',
        text: `Car ${this.stockNo()} loaded for editing.`,
      });
    } catch (err) {
      console.error('[applyPendingCar] failed:', err);
      this.stockError.set('Loaded the car but could not apply all fields. Check the console.');
      this.pendingCar.set(null);
      this.stockState.set('editing');
      this.stockDraft.setValue('');
      try { this.stockDraft.enable(); } catch { /* destroyed */ }
    }
  }

  /* ============================================================
     DELETE CAR  (edit mode only)
     ============================================================ */

  openDeleteModal(): void {
    if (!this.canDelete() || this.deleting()) return;
    this.deleteConfirmDraft.setValue('');
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.deleteConfirmDraft.setValue('');
  }

  confirmDelete(): void {
    if (!this.deleteConfirmValid() || this.deleting()) return;

    const stockNo = this.stockNo();
    this.deleting.set(true);

    this.api
      .deleteCar({ stockNo })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deleting.set(false)),
      )
      .subscribe({
        next: () => {
          this.showDeleteModal.set(false);
          this.deleteConfirmDraft.setValue('');

          this.resetForm();
          this.mode.set('edit');
          this.stockState.set('editing');

          this.notice.set({
            kind: 'ok',
            text: `Car ${stockNo} deleted.`,
          });
        },
        error: (err) => {
          console.error('[delete] failed:', err);
          this.showDeleteModal.set(false);
          this.notice.set({
            kind: 'err',
            text:
              err?.error?.message ??
              `Could not delete car ${stockNo}. Check your connection and try again.`,
          });
        },
      });
  }

  /* ---------- VIN: decode → populate ---------- */
  onVinButton(): void {
    const state = this.vinState();
    if (state === 'populate') {
      this.applyDecoded();
      return;
    }
    if (state === 'decoding') return;
    this.decodeVin();
  }

  private decodeVin(): void {
    const vin = this.f.vin.value.trim().toUpperCase();
    this.decoded.set(null);
    this.decodeMsg.set('');

    if (vin.length < 11) {
      this.decodeMsg.set('Enter the full VIN / chassis number first.');
      return;
    }

    this.vinState.set('decoding');
    this.api
      .decodeVin(vin)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.vinState() === 'decoding') this.vinState.set('idle');
        }),
      )
      .subscribe({
        next: (d) => {
          if (Object.keys(d).length) {
            this.decoded.set(d);
            this.vinState.set('populate');
          } else {
            this.decodeMsg.set(
              'No details found for this number. You can fill the fields in manually.',
            );
          }
        },
        error: () => {
          this.decodeMsg.set(
            'VIN lookup failed. Check your connection or fill the fields in manually.',
          );
        },
      });
  }

  applyDecoded(): void {
    const d = this.decoded();
    if (!d) return;
    const c = this.f;
    if (d.make) c.make.setValue(d.make);
    if (d.model) c.model.setValue(d.model);
    if (d.year) c.year.setValue(d.year);
    if (d.body) c.body.setValue(d.body);
    if (d.engine) c.engine.setValue(d.engine);
    if (d.drive) c.drive.setValue(d.drive);
    if (d.transmission) c.transmission.setValue(d.transmission);
    if (d.fuel) c.fuel.setValue(d.fuel);
    this.form.markAsDirty();
    this.decoded.set(null);
    this.vinState.set('idle');
    this.decodeMsg.set('Vehicle details populated from VIN.');
  }

  onVinInput(): void {
    if (this.vinState() === 'populate') {
      this.vinState.set('idle');
      this.decoded.set(null);
    }
    if (this.decodeMsg()) this.decodeMsg.set('');
  }

  /* ---------- pricing / financing ---------- */
  toggleFinancing(): void {
    this.f.financing.setValue(!this.f.financing.value);
  }

  addBank(): void {
    const b = this.bankDraft.value.trim();
    if (b && !this.banks().some((x) => x.toLowerCase() === b.toLowerCase())) {
      this.banks.update((l) => [...l, b]);
    }
    this.bankDraft.setValue('');
  }

  removeBank(b: string): void {
    this.banks.update((l) => l.filter((x) => x !== b));
  }

  /* ---------- features ---------- */
  toggleFeature(f: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  startAdd(): void {
    this.adding.set(true);
    clearTimeout(this.addFeatureTimer);
    this.addFeatureTimer = setTimeout(() => {
      this.addFeatureTimer = undefined;
      // Scope to this component's host instead of document.
      const root: ParentNode = this.hostView?.nativeElement ?? this.hostRef.nativeElement;
      (root.querySelector('.chip--input') as HTMLInputElement | null)?.focus();
    });
  }

  addFeature(raw: string): void {
    const v = raw.trim();
    if (v && !this.features().includes(v)) {
      this.features.update((l) => [...l, v]);
      this.selected.update((s) => new Set(s).add(v));
    }
    this.adding.set(false);
  }

  removeFeature(ft: string): void {
    this.features.update((list) => list.filter((f) => f !== ft));
    this.selected.update((s) => {
      if (!s.has(ft)) return s;
      const next = new Set(s);
      next.delete(ft);
      return next;
    });
  }

  /* ---------- photos (URL based) ---------- */
  private isImageUrl(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      return true;
    } catch {
      return false;
    }
  }

  private addPhotoUrl(raw: string): boolean {
    const url = raw.trim();
    if (!url) return false;
    if (this.photos().length >= this.maxPhotos) {
      this.notice.set({
        kind: 'err',
        text: `Maximum of ${this.maxPhotos} photos reached.`,
      });
      return false;
    }
    if (!this.isImageUrl(url)) {
      this.notice.set({ kind: 'err', text: 'Enter a valid image URL (https://…).' });
      return false;
    }
    if (this.photos().some((p) => p.url === url)) {
      this.notice.set({ kind: 'err', text: 'That photo URL is already added.' });
      return false;
    }
    this.photos.update((list) => [...list, { url }]);
    return true;
  }

  private clearPhotoInputsIfAnyPhotos(): void {
    if (this.photos().length > 0) {
      if (this.photoUrlDraft.value) this.photoUrlDraft.setValue('');
      if (this.pasteDraft.value) this.pasteDraft.setValue('');
    }
  }

  addPhotoFromInput(): void {
    this.addPhotoUrl(this.photoUrlDraft.value);
    this.clearPhotoInputsIfAnyPhotos();
  }

  addPastedLinks(): void {
    const raw = this.pasteDraft.value;
    if (!raw.trim()) return;

    const candidates = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let added = 0;
    let skipped = 0;

    for (const c of candidates) {
      const before = this.photos().length;
      const ok = this.addPhotoUrl(c);
      if (ok && this.photos().length > before) added++;
      else skipped++;
    }

    this.clearPhotoInputsIfAnyPhotos();

    if (added && !skipped) {
      this.notice.set({
        kind: 'ok',
        text: `${added} photo${added === 1 ? '' : 's'} added from links.`,
      });
    } else if (added && skipped) {
      this.notice.set({
        kind: 'ok',
        text: `${added} added, ${skipped} skipped (invalid, duplicate, or over limit).`,
      });
    }
  }

  removePhoto(i: number): void {
    this.photos.update((list) => list.filter((_, idx) => idx !== i));
    this.clearPhotoInputsIfAnyPhotos();
  }

  ngOnDestroy(): void {
    // Clear any pending timers; subscriptions are handled by takeUntilDestroyed.
    clearTimeout(this.stockTimer);
    this.stockTimer = undefined;
    clearTimeout(this.addFeatureTimer);
    this.addFeatureTimer = undefined;
    this.pendingAction = null;
  }

  /* ---------- documents ---------- */
  setDoc(index: number, e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.docs.update((list) =>
      list.map((d, i) =>
        i === index ? { ...d, file, serverName: undefined } : d,
      ),
    );
  }

  removeDoc(index: number): void {
    this.docs.update((list) =>
      list.map((d, i) =>
        i === index ? { ...d, file: null, serverName: undefined } : d,
      ),
    );
  }

  /* ---------- review video ---------- */
  clearReviewVideo(): void {
    this.f.reviewVideoUrl.setValue('');
    this.f.reviewVideoUrl.markAsDirty();
  }

  /* ---------- reset / clear form ---------- */
  resetForm(): void {
    this.form.reset({
      make: '',
      model: '',
      year: new Date().getFullYear(),
      body: '',
      colour: '',
      mileage: 0,
      engine: 0,
      drive: '2WD',
      transmission: 'Automatic',
      fuel: 'Petrol',
      vin: '',
      source: this.sources[0],
      branch: this.branches[0],
      cost: 0,
      price: 0,
      negotiable: false,
      financing: false,
      notes: '',
      showOnWeb: true,
      salesperson: this.salespeople[0],
      reviewVideoUrl: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.showErrors.set(false);

    this.bankDraft.setValue('');
    this.banks.set([]);
    this.selected.set(new Set());
    this.adding.set(false);

    this.photoUrlDraft.setValue('');
    this.pasteDraft.setValue('');
    this.photos.set([]);

    this.docs.set([
      { label: 'Logbook / ownership', file: null },
      { label: 'Inspection report', file: null },
      { label: 'Valuation certificate', file: null },
      { label: 'Seller ID / KRA PIN', file: null },
    ]);

    this.stage.set('draft');
    this.carId.set(null);
    this.stockNo.set('');
    this.savedAt.set('');
    this.saving.set(false);

    this.vinState.set('idle');
    this.decoded.set(null);
    this.decodeMsg.set('');

    // stock preview
    this.stockPreview.set('');
    clearTimeout(this.stockTimer);
    this.stockTimer = undefined;

    // stock lookup
    try { this.stockDraft.enable(); } catch { /* destroyed */ }
    this.stockDraft.setValue('');
    this.stockError.set('');
    this.pendingCar.set(null);

    // delete modal
    this.showDeleteModal.set(false);
    this.deleteConfirmDraft.setValue('');

    this.notice.set(null);

    // Clear native file inputs — scoped to this component's host.
    const root: ParentNode = this.hostView?.nativeElement ?? this.hostRef.nativeElement;
    root
      .querySelectorAll<HTMLInputElement>('.docs input[type="file"]')
      .forEach((el) => (el.value = ''));
  }

  /* ---------- save / submit ---------- */
  private snapshot(status: Status): Record<string, unknown> {
    const v = this.form.getRawValue();
    const previewStock = this.mode() === 'add' ? this.stockPreview() : this.stockNo();

    return {
      ...v,
      stockNo: previewStock || undefined,
      vin: v.vin.trim().toUpperCase(),
      make: v.make.trim(),
      model: v.model.trim(),
      margin: v.price - v.cost,
      banks: v.financing ? this.banks() : [],
      features: [...this.selected()],
      photos: this.photos().map((p) => p.url),
      documents: this.docs()
        .filter((d) => d.file)
        .map((d) => ({
          label: d.label,
          fileName: d.file!.name || d.serverName,
          existing: !!d.serverName && d.file!.size === 0,
        })),
      status,
    };
  }

  saveDraft(): void {
    this.persist('draft');
  }

  submit(): void {
    this.persist('submitted');
  }

  private persist(status: Status): void {
    if (this.saving()) return;
    this.notice.set(null);

    if (status === 'submitted') {
      this.showErrors.set(true);
      this.form.markAllAsTouched();
      if (this.form.invalid || this.bankMissing()) {
        this.notice.set({
          kind: 'err',
          text: 'Please complete the highlighted fields before submitting.',
        });
        return;
      }
    }

    const payload = this.snapshot(status);
    const docFiles = this.docs()
      .filter((d) => d.file)
      .map((d) => d.file!);

    const wasEdit = this.mode() === 'edit';

    this.saving.set(true);
    this.api
      .saveCar(this.carId(), payload, [], docFiles)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (res) => {
          const savedId = res.id;
          const savedStockNo = res.stockNo ?? this.stockNo();
          const savedTime = this.now();
          const finalPayload = this.snapshot(status);
          const record = { ...finalPayload, id: savedId, stockNo: savedStockNo };

          if (status === 'submitted') {
            this.submitted.emit(record);

            this.resetForm();

            if (wasEdit) {
              this.mode.set('edit');
              this.stockState.set('editing');
            }

            this.notice.set({
              kind: 'ok',
              text: `Car submitted for review${savedStockNo ? ` (${savedStockNo})` : ''}.`,
            });
          } else {
            if (wasEdit) {
              this.resetForm();
              this.mode.set('edit');
              this.stockState.set('editing');
              this.notice.set({
                kind: 'ok',
                text: `Draft saved${savedStockNo ? ` (${savedStockNo})` : ''}.`,
              });
            } else {
              this.carId.set(savedId);
              if (savedStockNo) this.stockNo.set(savedStockNo);
              this.savedAt.set(savedTime);
              this.notice.set({ kind: 'ok', text: 'Draft saved.' });
            }
            this.draftSaved.emit(record);
          }
        },
        error: (err) =>
          this.notice.set({
            kind: 'err',
            text:
              err?.error?.message ??
              'Could not save the car. Check your connection and try again.',
          }),
      });
  }

  /* ---------- legacy hook ---------- */
  editCarDetails(): void {
    this.clickEdit();
  }
}