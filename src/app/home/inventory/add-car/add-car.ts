import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';
import { CarService, DecodedVin } from '../../../car-service';

interface Doc { label: string; file: File | null; }
interface Photo { file: File; url: string; }
interface Notice { kind: 'ok' | 'err'; text: string; }
type Stage = 'draft' | 'review' | 'live';
type Status = 'draft' | 'submitted';
type VinState = 'idle' | 'decoding' | 'populate';

@Component({
  selector: 'app-add-car',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './add-car.html',
  styleUrls: ['./add-car.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCar implements OnDestroy {
  @Output() submitted = new EventEmitter<Record<string, unknown>>();
  @Output() draftSaved = new EventEmitter<Record<string, unknown>>();

  @ViewChild('picker') private picker!: ElementRef<HTMLInputElement>;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CarService);

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
    // vehicle
    make: ['', [Validators.required, Validators.maxLength(60)]],
    model: ['', [Validators.required, Validators.maxLength(80)]],
    year: [
      new Date().getFullYear(),
      [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)],
    ],
    body: [''],
    colour: [''],
    // specifications
    mileage: [0, [Validators.min(0)]],
    engine: [0, [Validators.min(0)]],
    drive: ['2WD'],
    transmission: ['Automatic'],
    fuel: ['Petrol'],
    vin: ['', [Validators.maxLength(25)]],
    // acquisition & pricing
    source: [this.sources[0]],
    branch: [this.branches[0]],
    cost: [0, [Validators.min(0)]],
    price: [0, [Validators.required, Validators.min(1)]],
    negotiable: [false],
    financing: [false],
    // notes + publishing + media
    notes: [''],
    showOnWeb: [true],
    salesperson: [this.salespeople[0]],
    reviewVideoUrl: [''],
  });

  readonly f = this.form.controls;

  /** Live snapshot of the form as a signal. */
  readonly v = toSignal(
    this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())),
    { requireSync: true },
  );

  /* ---------- extra UI state ---------- */
  readonly bankDraft = new FormControl('', { nonNullable: true });
  readonly banks = signal<string[]>([]);

  readonly features = signal<string[]>([
    'Leather seats', 'Sunroof', 'Reverse camera', 'Apple CarPlay', 'Keyless entry',
  ]);
  readonly selected = signal(new Set<string>());
  readonly adding = signal(false);

  readonly photos = signal<Photo[]>([]);
  readonly dragging = signal(false);
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
    if (this.stage() !== 'draft') return `SUBMITTED · ${this.savedAt()}`;
    return this.savedAt() ? `DRAFT · SAVED ${this.savedAt()}` : 'DRAFT · NOT SAVED YET';
  });

  readonly vinButtonLabel = computed(() => {
    switch (this.vinState()) {
      case 'decoding': return 'DECODING…';
      case 'populate': return 'POPULATE';
      default: return 'DECODE';
    }
  });

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
    setTimeout(
      () => (document.querySelector('.chip--input') as HTMLInputElement | null)?.focus(),
    );
  }

  addFeature(raw: string): void {
    const v = raw.trim();
    if (v && !this.features().includes(v)) {
      this.features.update((l) => [...l, v]);
      this.selected.update((s) => new Set(s).add(v));
    }
    this.adding.set(false);
  }
/** Discards a feature from the list entirely (and unselects it). */
removeFeature(ft: string): void {
  this.features.update((list) => list.filter((f) => f !== ft));
  this.selected.update((s) => {
    if (!s.has(ft)) return s;
    const next = new Set(s);
    next.delete(ft);
    return next;
  });
}
  /* ---------- photos ---------- */
  openPicker(): void {
    this.picker.nativeElement.click();
  }

  onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.addFiles(input.files);
    input.value = '';
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(true);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    this.addFiles(e.dataTransfer?.files);
  }

  private addFiles(files: FileList | null | undefined): void {
    if (!files?.length) return;
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const room = this.maxPhotos - this.photos().length;
    const accepted = images.slice(0, Math.max(room, 0));
    if (!accepted.length) {
      if (images.length)
        this.notice.set({
          kind: 'err',
          text: `Maximum of ${this.maxPhotos} photos reached.`,
        });
      return;
    }
    if (accepted.length < images.length) {
      this.notice.set({
        kind: 'err',
        text: `Only ${accepted.length} of ${images.length} photos added (limit ${this.maxPhotos}).`,
      });
    }
    this.photos.update((list) => [
      ...list,
      ...accepted.map<Photo>((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }

  removePhoto(i: number): void {
    const p = this.photos()[i];
    if (p) URL.revokeObjectURL(p.url);
    this.photos.update((list) => list.filter((_, idx) => idx !== i));
  }

  ngOnDestroy(): void {
    this.photos().forEach((p) => URL.revokeObjectURL(p.url));
  }

  /* ---------- documents ---------- */
  setDoc(index: number, e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.docs.update((list) =>
      list.map((d, i) => (i === index ? { ...d, file } : d)),
    );
  }

  removeDoc(index: number): void {
    this.docs.update((list) =>
      list.map((d, i) => (i === index ? { ...d, file: null } : d)),
    );
  }

  /* ---------- review video ---------- */
  clearReviewVideo(): void {
    this.f.reviewVideoUrl.setValue('');
    this.f.reviewVideoUrl.markAsDirty();
  }

  /* ---------- save / submit ---------- */
  private snapshot(status: Status): Record<string, unknown> {
    const v = this.form.getRawValue();
    return {
      ...v,
      vin: v.vin.trim().toUpperCase(),
      make: v.make.trim(),
      model: v.model.trim(),
      margin: v.price - v.cost,
      banks: v.financing ? this.banks() : [],
      features: [...this.selected()],
      documents: this.docs()
        .filter((d) => d.file)
        .map((d) => ({ label: d.label, fileName: d.file!.name })),
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

    this.saving.set(true);
    this.api
      .saveCar(this.carId(), payload, this.photos().map((p) => p.file), docFiles)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.carId.set(res.id);
          if (res.stockNo) this.stockNo.set(res.stockNo);
          this.savedAt.set(this.now());
          const record = { ...payload, id: res.id, stockNo: this.stockNo() };

          if (status === 'submitted') {
            this.stage.set('review');
            this.notice.set({ kind: 'ok', text: 'Car submitted for review.' });
            this.submitted.emit(record);
          } else {
            this.notice.set({ kind: 'ok', text: 'Draft saved.' });
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
}