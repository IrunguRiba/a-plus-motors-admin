import { Component, computed, output, signal } from '@angular/core';

interface Car {
  name: string;
  stock: string;
  score: number;
  app: string;
  length: string;
  audience: string;
  leads: number;
  type: string;
  tags: string[];
  km: string;
  price: string;
  margin: string;
  badge: string;
  recTitle: string;
  recBody: string;
  ages: number[];
  men: number;
  locations: string[];
  bestBucket: number;
  basis: string;
  signal: string;
}

@Component({
  selector: 'app-review-planner',
  imports: [],
  templateUrl: './review-planner.html',
  styleUrl: './review-planner.css',
})
export class ReviewPlanner {
  readonly ageLabels = ['18–24', '25–34', '35–44', '45–54', '55+'];
  readonly buckets = [
    { label: '0–3 min', value: 1.6 },
    { label: '3–6 min', value: 3.2 },
    { label: '6–8 min', value: 4.1 },
    { label: '8–10 min', value: 4.9 },
    { label: '10–14 min', value: 4.4 },
    { label: '14+ min', value: 3.8 },
  ];
  readonly maxBucket = 4.9;

  readonly chips = [
    { key: 'all', label: 'All cars', showCount: true },
    { key: 'content', label: 'Needs content', showCount: true },
    { key: 'aging', label: 'Aging 60d+', showCount: true },
    { key: 'margin', label: 'High margin', showCount: true },
    { key: 'SUV', label: 'SUVs', showCount: false },
    { key: 'Pickup', label: 'Pickups', showCount: false },
    { key: 'Sedan', label: 'Sedans', showCount: false },
  ];

  readonly channels = [
    { platform: 'YouTube · review', length: '8–10 min', watched: '49% of video', use: 'Full walkaround, test drive, honest pros and cons' },
    { platform: 'YouTube · Shorts', length: 'Under 45 sec', watched: '82% of video', use: 'Teaser that sends people to the full review' },
    { platform: 'TikTok', length: '30–60 sec', watched: '71% of video', use: 'One hook, one feature, price on screen' },
    { platform: 'Instagram · Reels', length: '20–45 sec', watched: '66% of video', use: 'Style-led cars, colours and interiors' },
    { platform: 'Facebook · video', length: '60–90 sec', watched: '38% of video', use: 'Yard updates and price drops, captions on' },
  ];

  readonly cars: Car[] = [
    {
      name: 'Toyota Harrier 2021', stock: 'AP-0243', score: 92, app: 'YouTube', length: '8–10 min',
      audience: 'Men 25–40 · Nairobi, Kiambu', leads: 34, type: 'SUV', tags: ['content', 'margin'],
      km: '42,000 km', price: 'KES 4,250,000', margin: '14.4% margin', badge: 'Selling fast',
      recTitle: 'YouTube, 8–10 min walkaround and test drive.',
      recBody: 'Cut a 45 sec TikTok and Reel from the same shoot. Pin the financing offer in the first comment.',
      ages: [8, 38, 31, 15, 8], men: 71, locations: ['Nairobi 52%', 'Kiambu 18%', 'Kajiado 9%', 'Mombasa 7%'],
      bestBucket: 3, basis: 'Based on your last 18 YouTube car reviews. 8–10 min earns the most watch time.',
      signal: '11 walk-ins asked about the Harrier this month. 4 of them had watched a review first. Social cannot see this on its own.',
    },
    {
      name: 'Mazda CX-5 2020', stock: 'AP-0238', score: 84, app: 'TikTok', length: '45–60 sec',
      audience: 'Women 28–38 · Nairobi', leads: 26, type: 'SUV', tags: ['content'],
      km: '51,000 km', price: 'KES 3,650,000', margin: '12.8% margin', badge: 'Trending',
      recTitle: 'TikTok, 45–60 sec feature reel.',
      recBody: 'Lead with the interior and boot space. Put the price on screen and link the full review in the bio.',
      ages: [12, 41, 29, 12, 6], men: 38, locations: ['Nairobi 61%', 'Kiambu 14%', 'Kajiado 8%', 'Mombasa 6%'],
      bestBucket: 1, basis: 'Based on your last 24 TikTok car posts. 3–6 min earns the most watch time on long form.',
      signal: '7 walk-ins asked about the CX-5 this month. 3 of them had watched a TikTok first.',
    },
    {
      name: 'Toyota Hilux 2020', stock: 'AP-0219', score: 79, app: 'TikTok + YouTube', length: '45 sec · 6 min',
      audience: 'Men 30–45 · Kajiado, Machakos', leads: 19, type: 'Pickup', tags: ['aging', 'margin'],
      km: '68,000 km', price: 'KES 4,900,000', margin: '13.1% margin', badge: 'Aging 60d+',
      recTitle: 'TikTok teaser, then a 6 min YouTube review.',
      recBody: 'Show load capacity and off-road clips. Pin the price drop in the first comment.',
      ages: [4, 24, 39, 24, 9], men: 86, locations: ['Nairobi 28%', 'Kajiado 24%', 'Machakos 19%', 'Mombasa 5%'],
      bestBucket: 2, basis: 'Based on your last 11 pickup reviews. 6–8 min earns the most watch time.',
      signal: '5 walk-ins asked about the Hilux this month. 2 of them had watched a review first.',
    },
    {
      name: 'Mercedes C200 2019', stock: 'AP-0214', score: 71, app: 'Instagram', length: '30–45 sec',
      audience: 'Ages 25–35 · Nairobi, Mombasa', leads: 14, type: 'Sedan', tags: ['content', 'margin'],
      km: '47,000 km', price: 'KES 4,600,000', margin: '15.2% margin', badge: 'High margin',
      recTitle: 'Instagram Reel, 30–45 sec style cut.',
      recBody: 'Focus on the interior lighting and colours. Share to Stories with the showroom location.',
      ages: [14, 46, 26, 9, 5], men: 57, locations: ['Nairobi 44%', 'Mombasa 21%', 'Kiambu 10%', 'Kajiado 5%'],
      bestBucket: 0, basis: 'Based on your last 15 Instagram Reels. Short cuts earn the most watch time.',
      signal: '4 walk-ins asked about the C200 this month. 1 of them had watched a Reel first.',
    },
    {
      name: 'Subaru Forester 2019', stock: 'AP-0231', score: 66, app: 'YouTube', length: '6–8 min',
      audience: 'Families 30–45 · Kiambu', leads: 12, type: 'SUV', tags: ['aging'],
      km: '59,000 km', price: 'KES 3,200,000', margin: '11.6% margin', badge: 'Aging 60d+',
      recTitle: 'YouTube, 6–8 min family walkaround.',
      recBody: 'Cover boot space, rear seats and safety features. Pin the financing offer in the first comment.',
      ages: [3, 22, 44, 23, 8], men: 54, locations: ['Nairobi 38%', 'Kiambu 31%', 'Kajiado 7%', 'Mombasa 4%'],
      bestBucket: 2, basis: 'Based on your last 18 YouTube car reviews. 6–8 min suits family cars best.',
      signal: '3 walk-ins asked about the Forester this month. 2 of them had watched a review first.',
    },
    {
      name: 'Honda Fit 2018', stock: 'AP-0227', score: 58, app: 'Facebook', length: '60–90 sec',
      audience: 'First-time buyers 22–30', leads: 11, type: 'Sedan', tags: ['content'],
      km: '72,000 km', price: 'KES 1,450,000', margin: '9.8% margin', badge: 'Needs content',
      recTitle: 'Facebook video, 60–90 sec with captions on.',
      recBody: 'Show fuel economy and the monthly instalment. Post the price drop as a yard update.',
      ages: [31, 44, 16, 6, 3], men: 52, locations: ['Nairobi 49%', 'Kiambu 15%', 'Mombasa 9%', 'Kajiado 6%'],
      bestBucket: 1, basis: 'Based on your last 9 Facebook videos. 60–90 sec earns the most watch time.',
      signal: '2 walk-ins asked about the Fit this month. Neither had watched a video first.',
    },
  ];

  readonly calendarAdded = output<Car>();
  readonly calendarRemoved = output<Car>();
  readonly briefSent = output<{ car: Car; text: string }>();
  readonly carSelected = output<Car>();

  readonly query = signal('');
  readonly filter = signal('all');
  readonly appFilter = signal('all');
  readonly minScore = signal(0);
  readonly sortKey = signal<'score' | 'leads' | 'name'>('score');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly filtersOpen = signal(false);
  readonly selectedStock = signal('AP-0243');
  readonly scheduled = signal<string[]>(this.loadScheduled());
  readonly toast = signal<string | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  readonly appOptions = ['all', ...Array.from(new Set(this.cars.map(c => c.app)))];

  readonly counts = computed<Record<string, number>>(() => {
    const result: Record<string, number> = { all: this.cars.length };
    for (const chip of this.chips) {
      if (chip.key !== 'all') {
        result[chip.key] = this.cars.filter(c => this.matchesChip(c, chip.key)).length;
      }
    }
    return result;
  });

  readonly visibleCars = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    const app = this.appFilter();
    const min = this.minScore();
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return this.cars
      .filter(c => {
        const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.stock.toLowerCase().includes(q);
        const matchesApp = app === 'all' || c.app === app;
        return matchesQuery && matchesApp && c.score >= min && this.matchesChip(c, f);
      })
      .sort((a, b) => {
        const result = key === 'name' ? a.name.localeCompare(b.name) : a[key] - b[key];
        return result * dir;
      });
  });

  readonly selected = computed(() => this.cars.find(c => c.stock === this.selectedStock()) ?? this.cars[0]);

  readonly isScheduled = computed(() => this.scheduled().includes(this.selected().stock));

  readonly activeFilterCount = computed(() => (this.appFilter() !== 'all' ? 1 : 0) + (this.minScore() > 0 ? 1 : 0));

  readonly showingText = computed(() => {
    const shown = this.visibleCars().length;
    return shown ? `Showing 1–${shown} of ${this.cars.length}` : `Showing 0 of ${this.cars.length}`;
  });

  readonly brief = computed(() => {
    const c = this.selected();
    return [
      `Review brief: ${c.name} (${c.stock})`,
      `${c.km} · ${c.price} · ${c.margin}`,
      `Post on: ${c.app}, ${c.length}`,
      `Audience: ${c.audience}`,
      `Plan: ${c.recTitle} ${c.recBody}`,
      `Showroom signal: ${c.signal}`,
    ].join('\n');
  });

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.query.set('');
  }

  setFilter(key: string): void {
    this.filter.set(key);
  }

  toggleFilters(): void {
    this.filtersOpen.update(open => !open);
  }

  setAppFilter(event: Event): void {
    this.appFilter.set((event.target as HTMLSelectElement).value);
  }

  setMinScore(event: Event): void {
    this.minScore.set(Number((event.target as HTMLInputElement).value));
  }

  resetFilters(): void {
    this.query.set('');
    this.filter.set('all');
    this.appFilter.set('all');
    this.minScore.set(0);
  }

  sortBy(key: 'score' | 'leads' | 'name'): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'name' ? 'asc' : 'desc');
    }
  }

  arrow(key: string): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  select(stock: string): void {
    this.selectedStock.set(stock);
    this.carSelected.emit(this.selected());
  }

  toggleCalendar(): void {
    const car = this.selected();
    const list = this.scheduled();
    if (list.includes(car.stock)) {
      this.scheduled.set(list.filter(s => s !== car.stock));
      this.calendarRemoved.emit(car);
      this.showToast(`${car.name} removed from the content calendar`);
    } else {
      this.scheduled.set([...list, car.stock]);
      this.calendarAdded.emit(car);
      this.showToast(`${car.name} added to the content calendar`);
    }
    this.saveScheduled();
  }

  async sendBrief(): Promise<void> {
    const car = this.selected();
    const text = this.brief();
    this.briefSent.emit({ car, text });
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Brief copied. Paste it to your salesperson');
    } catch {
      this.showToast('Brief ready to send');
    }
  }

  bar(value: number, max: number): number {
    return (value / max) * 100;
  }

  private matchesChip(car: Car, key: string): boolean {
    return key === 'all' || car.type === key || car.tags.includes(key);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }

  private loadScheduled(): string[] {
    try {
      const raw = localStorage.getItem('aplus-review-calendar');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveScheduled(): void {
    try {
      localStorage.setItem('aplus-review-calendar', JSON.stringify(this.scheduled()));
    } catch {}
  }
}