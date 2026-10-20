import { Component, ElementRef, computed, effect, inject, model, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

type Kind = 'nav' | 'suggestion' | 'recent' | 'help' | 'car' | 'customer' | 'content';

interface Tab {
  label: string;
  route: string;
}

interface Item {
  key: string;
  kind: Kind;
  label: string;
  hint: string;
  tab: string;
  keywords: string;
  query?: string;
}

interface Section {
  title: string;
  col: 'left' | 'right';
  clearable?: boolean;
  rows: { item: Item; index: number }[];
}

interface Recent {
  label: string;
  hint: string;
  tab: string;
  query?: string;
}

const TABS: Record<string, Tab> = {
  overview: { label: 'Overview', route: '/overview' },
  inventory: { label: 'Inventory', route: '/inventory' },
  social: { label: 'Social Hub', route: '/people/social-hub' },
  planner: { label: 'Review Planner', route: '/people/review-planner' },
  content: { label: 'Content & SEO', route: '/people/content-seo' },
  customers: { label: 'Customers', route: '/people/customers' },
};

const make = (kind: Kind, label: string, hint: string, tab: string, keywords = '', query?: string): Item => ({
  key: `${kind}:${label}`,
  kind,
  label,
  hint,
  tab,
  keywords,
  query,
});

const NAV: Item[] = [
  make('nav', 'Overview', 'Sales, stock and activity at a glance', 'overview', 'home dashboard summary'),
  make('nav', 'Inventory', 'Every car on the yard and its status', 'inventory', 'stock cars yard vehicles'),
  make('nav', 'Social Hub', 'Posts, channels and performance', 'social', 'social media youtube tiktok instagram facebook posts'),
  make('nav', 'Review Planner', 'Which car to feature, where and for whom', 'planner', 'review plan video content ranking score'),
  make('nav', 'Content & SEO', 'Website traffic, keywords and blog posts', 'content', 'seo blog website traffic google keywords'),
  make('nav', 'Customers', 'Walk-ins, chats and leads in one record', 'customers', 'contacts leads walk-in whatsapp crm people'),
];

const SUGGESTIONS: Item[] = [
  make('suggestion', 'Plan a review for the Harrier', 'Best app, length and audience', 'planner', 'toyota harrier video', 'Harrier'),
  make('suggestion', 'Cars that need content', 'Stock with no recent posts', 'planner', 'needs content missing posts', 'Needs content'),
  make('suggestion', 'Turn a trend into a blog post', 'Rising searches and viewer questions', 'content', 'trending draft blog'),
  make('suggestion', 'Add a walk-in', 'Quick capture under a minute', 'customers', 'new customer visitor showroom'),
  make('suggestion', 'Test drives today', 'Customers booked for a drive', 'customers', 'appointments schedule', 'Test drive'),
];

const HELP: Item[] = [
  make('help', 'How the sales score works', 'Demand, stock age, margin and walk-ins', 'planner', 'score ranking potential explain'),
  make('help', 'How to add a walk-in', 'Fill in the quick form and save', 'customers', 'new customer capture how'),
  make('help', 'How SEO score is calculated', 'The checklist behind the score', 'content', 'seo score checklist meta keyword'),
  make('help', 'Connect a social account', 'Link YouTube, TikTok, Instagram or Facebook', 'social', 'connect link channel account'),
];

const CARS: Item[] = [
  ['Toyota Harrier 2021', 'AP-0243'],
  ['Mazda CX-5 2020', 'AP-0238'],
  ['Toyota Hilux 2020', 'AP-0219'],
  ['Mercedes C200 2019', 'AP-0214'],
  ['Subaru Forester 2019', 'AP-0231'],
  ['Honda Fit 2018', 'AP-0227'],
].map(([name, stock]) => make('car', name, `Review plan · ${stock}`, 'planner', stock, name));

const CUSTOMERS: Item[] = [
  ['Grace Njeri', 'Toyota Harrier 2021'],
  ['Brian Otieno', 'Toyota Hilux 2020'],
  ['Faith Mwende', 'Mazda CX-5 2020'],
  ['Dennis Kiprop', 'Honda Fit 2018'],
  ['Aisha Hassan', 'Mercedes C200 2019'],
  ['Samuel Mutua', 'Subaru Forester 2019'],
  ['Lucy Wairimu', 'Nissan X-Trail 2018'],
].map(([name, car]) => make('customer', name, `Customer · ${car}`, 'customers', car, name));

const CONTENT: Item[] = [
  make('content', 'toyota harrier price kenya', 'Keyword · position #4', 'content', 'search keyword'),
  make('content', 'harrier vs cx-5', 'Keyword · position #12', 'content', 'search keyword'),
  make('content', 'car financing kenya', 'Keyword · position #9', 'content', 'search keyword'),
  make('content', 'Harrier vs CX-5', 'Blog draft', 'content', 'post draft blog pipeline'),
  make('content', "Harrier buyer's guide", 'Blog post · live', 'content', 'post blog live'),
];

const RECENT_KEY = 'aplus-search-recent';

const DEFAULT_RECENT: Recent[] = [
  { label: 'Sent brief for Toyota Harrier 2021', hint: 'Review Planner', tab: 'planner', query: 'Harrier' },
  { label: 'Drafted Harrier vs CX-5', hint: 'Content & SEO', tab: 'content' },
  { label: 'Added walk-in Samuel Mutua', hint: 'Customers', tab: 'customers', query: 'Samuel Mutua' },
];

@Component({
  selector: 'app-search',
  imports: [],
  templateUrl: './search.html',
  styleUrl: './search.css',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class Search {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly open = model(false);
  readonly navigated = output<string>();

  readonly input = viewChild<ElementRef<HTMLInputElement>>('field');

  readonly query = signal('');
  readonly active = signal(0);
  readonly recent = signal<Recent[]>(this.loadRecent());

  readonly sections = computed<Section[]>(() => {
    const q = this.query().trim().toLowerCase();
    const groups: { title: string; col: 'left' | 'right'; clearable?: boolean; items: Item[] }[] = [];

    if (!q) {
      groups.push(
        { title: 'Quick navigation', col: 'left', items: NAV },
        { title: 'Suggestions', col: 'left', items: SUGGESTIONS },
        {
          title: 'Recent actions',
          col: 'right',
          clearable: true,
          items: this.recent().map(r => make('recent', r.label, r.hint, r.tab, '', r.query)),
        },
        { title: 'Help', col: 'right', items: HELP },
      );
    } else {
      const tokens = q.split(/\s+/);
      const match = (list: Item[]) =>
        list.filter(i => {
          const hay = `${i.label} ${i.hint} ${i.keywords} ${TABS[i.tab].label}`.toLowerCase();
          return tokens.every(t => hay.includes(t));
        });
      groups.push(
        { title: 'Go to', col: 'left', items: match(NAV) },
        { title: 'Cars', col: 'left', items: match(CARS) },
        { title: 'Customers', col: 'left', items: match(CUSTOMERS) },
        { title: 'Content & SEO', col: 'left', items: match(CONTENT) },
        { title: 'Suggestions', col: 'left', items: match(SUGGESTIONS) },
        { title: 'Help', col: 'left', items: match(HELP) },
      );
    }

    let index = 0;
    return groups
      .filter(g => g.items.length)
      .map(g => ({
        title: g.title,
        col: g.col,
        clearable: g.clearable,
        rows: g.items.slice(0, 6).map(item => ({ item, index: index++ })),
      }));
  });

  readonly flat = computed(() => this.sections().flatMap(s => s.rows.map(r => r.item)));
  readonly left = computed(() => this.sections().filter(s => s.col === 'left'));
  readonly right = computed(() => this.sections().filter(s => s.col === 'right'));
  readonly searching = computed(() => this.query().trim().length > 0);

  constructor() {
    effect(() => {
      const isOpen = this.open();
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (isOpen) {
        setTimeout(() => this.input()?.nativeElement.focus(), 250);
      }
    });
  }

  tabLabel(tab: string): string {
    return TABS[tab].label;
  }

  isCurrent(item: Item): boolean {
    return item.kind === 'nav' && this.router.url.split('?')[0].startsWith(TABS[item.tab].route);
  }

  onKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.open() ? this.close() : this.show();
      return;
    }
    if (!this.open()) return;
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(-1);
    }
  }

  show(): void {
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    setTimeout(() => {
      this.query.set('');
      this.active.set(0);
    }, 400);
  }

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  clearQuery(): void {
    this.query.set('');
    this.active.set(0);
    this.input()?.nativeElement.focus();
  }

  setActive(index: number): void {
    this.active.set(index);
  }

  openActive(): void {
    const item = this.flat()[this.active()];
    if (item) this.go(item);
  }

  go(item: Item): void {
    const tab = TABS[item.tab];
    this.remember(item);
    this.router.navigate([tab.route], item.query ? { queryParams: { q: item.query } } : {});
    this.navigated.emit(tab.route);
    this.close();
  }

  clearRecent(): void {
    this.recent.set([]);
    this.saveRecent();
  }

  private move(step: number): void {
    const total = this.flat().length;
    if (!total) return;
    this.active.set((this.active() + step + total) % total);
    setTimeout(() => this.host.nativeElement.querySelector('.sr-row.active')?.scrollIntoView({ block: 'nearest' }), 0);
  }

  private remember(item: Item): void {
    if (item.kind === 'nav') return;
    const entry: Recent = { label: item.label, hint: TABS[item.tab].label, tab: item.tab, query: item.query };
    this.recent.update(list => [entry, ...list.filter(r => r.label !== entry.label)].slice(0, 5));
    this.saveRecent();
  }

  private loadRecent(): Recent[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_RECENT;
    } catch {
      return DEFAULT_RECENT;
    }
  }

  private saveRecent(): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent()));
    } catch {}
  }
}