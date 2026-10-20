import { Component, computed, output, signal } from '@angular/core';

type Stage = 'draft' | 'review' | 'live';
type CheckKey = 'keyword' | 'meta' | 'links' | 'video' | 'alt';
type KeywordSort = 'keyword' | 'position' | 'searches' | 'clicks';

interface Post {
  id: string;
  name: string;
  title: string;
  outline: string;
  stage: Stage;
  sub: string;
  tokens: string[];
  checks: Record<CheckKey, boolean>;
  note: string;
  savedAt: string;
}

interface Trend {
  id: string;
  tag: string;
  tone: 'green' | 'blue' | 'orange';
  title: string;
  body: string;
  postTitle: string;
  tokens: string[];
  outline: string;
  note: string;
}

@Component({
  selector: 'app-content-seo',
  imports: [],
  templateUrl: './content-seo.html',
  styleUrl: './content-seo.css',
})
export class ContentSeo {
  readonly periods = [
    { key: 7, label: 'Last 7 days' },
    { key: 30, label: 'Last 30 days' },
    { key: 90, label: 'Last 90 days' },
  ];

  readonly stats = [
    { label: 'Website visits', value: '18.2K', note: '12% vs previous 30 days', trend: 'up', highlight: false },
    { label: 'From Google search', value: '7.4K', note: '41% of all visits', trend: 'none', highlight: false },
    { label: 'Time on car pages', value: '2m 48s', note: '14 sec', trend: 'up', highlight: false },
    { label: 'Visit to enquiry', value: '3.4%', note: '0.6 pts · 619 enquiries', trend: 'flat', highlight: true },
  ];

  readonly sources = [
    { name: 'Google search', visits: 7.4, share: 41, color: '#1a4fd8' },
    { name: 'YouTube', visits: 3.6, share: 20, color: '#dc2626' },
    { name: 'Direct', visits: 2.9, share: 16, color: '#6b7280' },
    { name: 'TikTok', visits: 2.1, share: 11, color: '#0a0a0a' },
    { name: 'Instagram', visits: 1.3, share: 7, color: '#a21caf' },
    { name: 'Facebook', visits: 0.9, share: 5, color: '#2563eb' },
  ].map(s => ({ ...s, width: (s.visits / 7.4) * 100 }));

  readonly keywords = [
    { keyword: 'toyota harrier price kenya', position: 4, change: 2, searches: 5400, clicks: 612 },
    { keyword: 'used mazda cx-5 nairobi', position: 7, change: 1, searches: 2900, clicks: 244 },
    { keyword: 'toyota hilux 2020 for sale', position: 6, change: 0, searches: 2100, clicks: 170 },
    { keyword: 'harrier vs cx-5', position: 12, change: 5, searches: 1600, clicks: 88 },
    { keyword: 'car financing kenya', position: 9, change: -1, searches: 1300, clicks: 61 },
  ];

  readonly trends: Trend[] = [
    {
      id: 'harrier-vs-cx5', tag: 'Rising on Google', tone: 'green',
      title: 'Harrier vs CX-5: fuel use and resale value',
      body: 'Searches up 40% this month. You rank #12 and a post could move you up.',
      postTitle: 'Toyota Harrier vs Mazda CX-5: Which Should You Buy in Kenya?',
      tokens: ['harrier', 'cx-5'],
      outline: '1. Price and what you get at KES 3.6M–4.3M\n2. Fuel use in Nairobi traffic\n3. Resale value after three years\n4. Financing options with partner banks\n5. Our pick, with links to both cars',
      note: 'Built from 40% more searches, 34 viewer questions, and 11 walk-in enquiries. You review before it goes live.',
    },
    {
      id: 'first-time-buyers', tag: 'Rising on TikTok', tone: 'blue',
      title: 'Best cars under KES 1.5M for first-time buyers',
      body: 'Short clips on this topic get the most saves and financing questions.',
      postTitle: 'Best Cars Under KES 1.5M for First-Time Buyers in Kenya',
      tokens: ['first-time', 'buyers'],
      outline: '1. What KES 1.5M buys in Nairobi today\n2. Our five picks, with mileage and price\n3. Running costs: fuel, insurance, servicing\n4. How a deposit and instalments work\n5. What to check before you buy',
      note: 'Built from the most saved TikTok clips and financing questions this month. You review before it goes live.',
    },
    {
      id: 'import-or-local', tag: 'Asked in comments', tone: 'orange',
      title: 'Import or buy locally? What to know',
      body: '34 viewers asked across YouTube and Facebook this month.',
      postTitle: 'Import or Buy Locally in Kenya? What to Know Before You Decide',
      tokens: ['import', 'buy locally'],
      outline: '1. Total cost of importing, step by step\n2. Waiting time and risks\n3. What a local, inspected car costs\n4. Warranty and after-sales support\n5. Which route suits which buyer',
      note: 'Built from 34 viewer questions on YouTube and Facebook. You review before it goes live.',
    },
  ];

  readonly checkDefs: { key: CheckKey; label: string; weight: number }[] = [
    { key: 'keyword', label: 'Main keyword in title and first paragraph', weight: 32 },
    { key: 'meta', label: 'Meta description under 160 characters', weight: 28 },
    { key: 'links', label: 'Links to both cars in stock', weight: 26 },
    { key: 'video', label: 'Embeds the YouTube review', weight: 8 },
    { key: 'alt', label: 'Cover image alt text', weight: 6 },
  ];

  readonly stages: { key: Stage; label: string }[] = [
    { key: 'draft', label: 'Draft' },
    { key: 'review', label: 'In review' },
    { key: 'live', label: 'Live' },
  ];

  readonly week = [
    { day: 'Tue', task: 'Harrier full review shoot', channel: 'YouTube' },
    { day: 'Thu', task: 'Hilux walkaround, 45 sec', channel: 'TikTok' },
    { day: 'Fri', task: 'Publish Harrier vs CX-5', channel: 'Blog' },
    { day: 'Sat', task: 'Weekend yard open day', channel: 'Facebook' },
  ];

  readonly periodChange = output<number>();
  readonly postStarted = output<Post>();
  readonly postSubmitted = output<Post>();
  readonly postSaved = output<Post>();
  readonly autoDraftChange = output<boolean>();

  readonly period = signal(this.periods[1]);
  readonly periodOpen = signal(false);
  readonly sortKey = signal<KeywordSort>('clicks');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly stageFilter = signal<Stage | null>(null);
  readonly autoDraft = signal(true);
  readonly toast = signal<string | null>(null);
  readonly activeId = signal('harrier-vs-cx5');

  readonly posts = signal<Post[]>([
    {
      id: 'buyers-guide', name: "Harrier buyer's guide", title: "Toyota Harrier Buyer's Guide for Kenya",
      outline: '1. Which model years to look at\n2. Prices and mileage to expect\n3. Common checks before you buy\n4. Financing and trade-in',
      stage: 'live', sub: '2.2K visits · 3.9% enquiry rate', tokens: ['harrier'],
      checks: { keyword: true, meta: true, links: true, video: true, alt: true },
      note: 'Published and live on the website.', savedAt: '09:40',
    },
    {
      id: 'financing', name: 'How car financing works at A-Plus', title: 'How Car Financing Works at A-Plus Motors',
      outline: '1. Deposit and instalments\n2. Partner banks\n3. Documents you need\n4. How long approval takes',
      stage: 'review', sub: 'Submitted by Mary Wanjiru', tokens: ['financing'],
      checks: { keyword: true, meta: true, links: true, video: false, alt: true },
      note: 'Waiting for review before it goes live.', savedAt: '10:15',
    },
    {
      id: 'harrier-vs-cx5', name: 'Harrier vs CX-5', title: this.trends[0].postTitle, outline: this.trends[0].outline,
      stage: 'draft', sub: 'Drafted from trend data', tokens: this.trends[0].tokens,
      checks: { keyword: false, meta: true, links: true, video: false, alt: false },
      note: this.trends[0].note, savedAt: '11:32',
    },
  ]);

  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  readonly active = computed(() => this.posts().find(p => p.id === this.activeId()) ?? this.posts()[0]);
  readonly locked = computed(() => this.active().stage === 'live');

  readonly checks = computed(() => {
    const post = this.active();
    const title = post.title.toLowerCase();
    return this.checkDefs.map(def => {
      const auto = def.key === 'keyword' && post.tokens.length > 0;
      const done = auto ? post.tokens.every(t => title.includes(t)) : post.checks[def.key];
      return { ...def, auto, done };
    });
  });

  readonly score = computed(() => this.checks().reduce((sum, c) => sum + (c.done ? c.weight : 0), 0));

  readonly statusLabel = computed(() => {
    const post = this.active();
    if (post.stage === 'draft') return `Draft · auto-saved ${post.savedAt}`;
    return post.stage === 'review' ? 'In review' : 'Live';
  });

  readonly visiblePosts = computed(() => {
    const filter = this.stageFilter();
    return this.posts().filter(p => !filter || p.stage === filter);
  });

  readonly sortedKeywords = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.keywords].sort((a, b) => {
      const result = key === 'keyword' ? a.keyword.localeCompare(b.keyword) : a[key] - b[key];
      return result * dir;
    });
  });

  togglePeriodMenu(): void {
    this.periodOpen.update(open => !open);
  }

  selectPeriod(period: { key: number; label: string }): void {
    this.period.set(period);
    this.periodOpen.set(false);
    this.periodChange.emit(period.key);
  }

  sortBy(key: KeywordSort): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'keyword' || key === 'position' ? 'asc' : 'desc');
    }
  }

  arrow(key: string): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  draftFromTrend(trend: Trend): void {
    const existing = this.posts().find(p => p.id === trend.id);
    if (existing) {
      this.activeId.set(existing.id);
      this.showToast(`Opened ${existing.name}`);
      return;
    }
    const post: Post = {
      id: trend.id, name: trend.title, title: trend.postTitle, outline: trend.outline, stage: 'draft',
      sub: 'Drafted from trend data', tokens: trend.tokens,
      checks: { keyword: false, meta: false, links: false, video: false, alt: false },
      note: trend.note, savedAt: this.now(),
    };
    this.posts.update(list => [post, ...list]);
    this.activeId.set(post.id);
    this.postStarted.emit(post);
    this.showToast('Draft started from trend');
  }

  newPost(): void {
    const post: Post = {
      id: `post-${Date.now()}`, name: 'Untitled post', title: '', outline: '1. ', stage: 'draft',
      sub: 'Started by you', tokens: [],
      checks: { keyword: false, meta: false, links: false, video: false, alt: false },
      note: 'Add a title and an outline, then submit for review.', savedAt: this.now(),
    };
    this.posts.update(list => [post, ...list]);
    this.activeId.set(post.id);
    this.postStarted.emit(post);
  }

  openPost(id: string): void {
    this.activeId.set(id);
  }

  setStageFilter(stage: Stage): void {
    this.stageFilter.update(current => (current === stage ? null : stage));
  }

  isStageActive(stage: Stage): boolean {
    const filter = this.stageFilter();
    return filter === null ? stage === 'draft' : filter === stage;
  }

  onTitle(event: Event): void {
    const title = (event.target as HTMLTextAreaElement).value;
    const post = this.active();
    const name = post.name === 'Untitled post' || post.id.startsWith('post-') ? title.trim() || 'Untitled post' : post.name;
    this.patch(post.id, { title, name });
    this.touch();
  }

  onOutline(event: Event): void {
    this.patch(this.active().id, { outline: (event.target as HTMLTextAreaElement).value });
    this.touch();
  }

  toggleCheck(key: CheckKey): void {
    const post = this.active();
    if (post.stage === 'live') return;
    this.patch(post.id, { checks: { ...post.checks, [key]: !post.checks[key] } });
    this.touch();
  }

  saveDraft(): void {
    this.patch(this.active().id, { savedAt: this.now() });
    this.postSaved.emit(this.active());
    this.showToast('Draft saved');
  }

  submitForReview(): void {
    const post = this.active();
    if (!post.title.trim()) {
      this.showToast('Add a title before submitting');
      return;
    }
    this.patch(post.id, { stage: 'review', sub: 'Submitted by Joel Irungu', savedAt: this.now() });
    this.postSubmitted.emit(this.active());
    this.showToast('Submitted for review');
  }

  toggleAutoDraft(): void {
    this.autoDraft.update(on => !on);
    this.autoDraftChange.emit(this.autoDraft());
    this.showToast(this.autoDraft() ? 'Auto-draft is on' : 'Auto-draft is off');
  }

  private patch(id: string, changes: Partial<Post>): void {
    this.posts.update(list => list.map(p => (p.id === id ? { ...p, ...changes } : p)));
  }

  private touch(): void {
    clearTimeout(this.saveTimer);
    const id = this.active().id;
    this.saveTimer = setTimeout(() => this.patch(id, { savedAt: this.now() }), 1000);
  }

  private now(): string {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  private showToast(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }
}