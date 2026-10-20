import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';

interface Doc { label: string; file: string | null; }
interface Photo { url: string | null; }
interface Entry { time: string; text: string; }
type Stage = 'draft' | 'review' | 'live';

@Component({
  selector: 'app-add-car',
  standalone: true,
  templateUrl: './add-car.html',
  styleUrls: ['./add-car.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCar {
  /** Emits the full record when "Submit for review" is clicked. */
  @Output() submitted = new EventEmitter<Record<string, unknown>>();
  @Output() draftSaved = new EventEmitter<Record<string, unknown>>();

  @ViewChild('picker') private picker!: ElementRef<HTMLInputElement>;

  /* ---------- static options ---------- */
  readonly catalog: Record<string, string[]> = {
    Toyota: ['Harrier', 'Land Cruiser Prado', 'Fielder', 'Axio', 'Hilux', 'Noah', 'Vitz'],
    Nissan: ['X-Trail', 'Note', 'Juke', 'Navara'],
    Mazda: ['CX-5', 'Demio', 'Axela'],
    Subaru: ['Forester', 'Impreza', 'Outback'],
    Honda: ['Vezel', 'Fit', 'CR-V'],
    Mitsubishi: ['Outlander', 'Pajero', 'L200'],
  };
  readonly makeNames = Object.keys(this.catalog);
  readonly years = Array.from({ length: 22 }, (_, i) => 2026 - i);
  readonly bodyTypes = ['SUV', 'Sedan', 'Hatchback', 'Pickup', 'Van'];
  readonly colours = [
    { name: 'Pearl White', hex: '#f1f1ee' },
    { name: 'Black', hex: '#111111' },
    { name: 'Silver', hex: '#9a9ea6' },
    { name: 'Red', hex: '#8b1c1c' },
    { name: 'Blue', hex: '#1d3a6b' },
  ];
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
  readonly stockNo = 'AP-0244 · auto';
  readonly partner = 'Stanbic Bank';
  readonly maxPhotos = 12;

  /* ---------- form state ---------- */
  make = signal('Toyota');
  model = signal('Harrier');
  year = signal(2021);
  body = signal('SUV');
  colour = signal('Pearl White');

  mileage = signal(42000);
  engine = signal(1998);
  drive = signal('2WD');
  transmission = signal('Automatic');
  fuel = signal('Petrol');
  vin = signal('JTMRJREV5MD••••••');

  source = signal('Trade-in');
  branch = signal('Main Yard');
  cost = signal(3640000);
  price = signal(4250000);
  negotiable = signal(false);
  financing = signal(true);

  features = signal(['Leather seats', 'Sunroof', 'Reverse camera', 'Apple CarPlay', 'Keyless entry']);
  selected = signal(new Set(['Leather seats', 'Sunroof', 'Reverse camera', 'Keyless entry']));
  adding = signal(false);
  notes = signal('');

  photos = signal<Photo[]>([{ url: null }]);
  dragging = signal(false);
  docs = signal<Doc[]>([
    { label: 'Logbook / ownership', file: 'logbook_KDG214A.pdf' },
    { label: 'Inspection report', file: 'inspection_0244.pdf' },
    { label: 'Valuation certificate', file: null },
    { label: 'Seller ID / KRA PIN', file: null },
  ]);

  stage = signal<Stage>('draft');
  showOnWeb = signal(true);
  salesperson = signal('Mary Wanjiru');
  savedAt = signal('17:12');
  entries = signal<Entry[]>([
    { time: '17:08', text: 'Joel Irungu created draft' },
    { time: '17:10', text: 'VIN decoded · 2021 Toyota Harrier' },
    { time: '17:12', text: 'Photo added · cover set' },
  ]);

  /* ---------- derived ---------- */
  models = computed(() => this.catalog[this.make()] ?? []);
  margin = computed(() => this.price() - this.cost());
  marginPct = computed(() =>
    this.price() > 0 ? ((this.margin() / this.price()) * 100).toFixed(1) : '0.0'
  );
  uploadedCount = computed(() => this.docs().filter((d) => d.file).length);
  slots = computed<(Photo | null)[]>(() =>
    Array.from({ length: 5 }, (_, i) => this.photos()[i] ?? null)
  );

  /* ---------- helpers ---------- */
  val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  fmt(n: number): string {
    return n ? Math.abs(n) === n ? n.toLocaleString('en-US') : '-' + Math.abs(n).toLocaleString('en-US') : '';
  }

  num(target: WritableSignal<number>, e: Event): void {
    const el = e.target as HTMLInputElement;
    const n = Number(el.value.replace(/\D/g, ''));
    target.set(n);
    el.value = this.fmt(n);
  }

  private now(): string {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  private log(text: string): void {
    this.entries.update((list) => [...list, { time: this.now(), text }]);
  }

  /* ---------- vehicle ---------- */
  onMake(e: Event): void {
    const m = this.val(e);
    this.make.set(m);
    this.model.set(this.catalog[m][0]);
  }

  decodeVin(): void {
    this.log(`VIN decoded · ${this.year()} ${this.make()} ${this.model()}`);
  }

  /* ---------- pricing ---------- */
  toggleFinancing(): void {
    this.financing.update((v) => !v);
    this.log(this.financing() ? 'Financing enabled' : 'Financing disabled');
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
    setTimeout(() => (document.querySelector('.chip--input') as HTMLInputElement | null)?.focus());
  }

  addFeature(raw: string): void {
    const v = raw.trim();
    if (v && !this.features().includes(v)) {
      this.features.update((l) => [...l, v]);
      this.selected.update((s) => new Set(s).add(v));
    }
    this.adding.set(false);
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
    const incoming = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map<Photo>((f) => ({ url: URL.createObjectURL(f) }));
    if (!incoming.length) return;

    this.photos.update((list) => {
      // first real upload replaces the empty cover placeholder
      const base = list.length === 1 && list[0].url === null ? [] : list;
      return [...base, ...incoming].slice(0, this.maxPhotos);
    });
    this.log(incoming.length > 1 ? `${incoming.length} photos added` : 'Photo added');
  }

  /* ---------- documents ---------- */
  setDoc(index: number, e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.docs.update((list) => list.map((d, i) => (i === index ? { ...d, file: file.name } : d)));
    this.log(`${this.docs()[index].label} uploaded`);
  }

  /* ---------- actions ---------- */
  private snapshot(): Record<string, unknown> {
    return {
      make: this.make(), model: this.model(), year: this.year(), body: this.body(), colour: this.colour(),
      mileage: this.mileage(), engine: this.engine(), drive: this.drive(),
      transmission: this.transmission(), fuel: this.fuel(), vin: this.vin(),
      stockNo: this.stockNo, source: this.source(), branch: this.branch(),
      cost: this.cost(), price: this.price(), margin: this.margin(),
      negotiable: this.negotiable(), financing: this.financing(),
      features: [...this.selected()], notes: this.notes(),
      documents: this.docs(), showOnWebsite: this.showOnWeb(),
      salesperson: this.salesperson(), stage: this.stage(),
    };
  }

  saveDraft(): void {
    this.savedAt.set(this.now());
    this.log('Draft saved');
    this.draftSaved.emit(this.snapshot());
  }

  submit(): void {
    this.stage.set('review');
    this.savedAt.set(this.now());
    this.log('Submitted for review');
    this.submitted.emit(this.snapshot());
  }
}