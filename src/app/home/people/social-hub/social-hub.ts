import { Component, HostListener, computed, output, signal } from '@angular/core';

type RangeKey = '7' | '30' | '90';
type SortDir = 'asc' | 'desc';
type ChannelSortKey = 'followers' | 'reach' | 'engRate' | 'enquiries' | 'sold';
type PostSortKey = 'views' | 'eng' | 'enq';

interface RangeOption {
  key: RangeKey;
  label: string;
  days: number;
  /** Multiplier applied to the 30-day base numbers. */
  factor: number;
  /** Reach growth vs the previous period, in percent. */
  growth: number;
  /** Total cars sold by the yard (all sources) in the period. */
  totalSales: number;
}

interface ChannelDef {
  name: string;
  color: string;
  kind: 'social' | 'web';
  followers: number | null;
  followersSuffix?: string;
  reach: number;
  reachSuffix?: string;
  rate: number;
  rateSuffix?: string;
  enquiries: number | null;
  sold: number | null;
  lastSync: string;
}

interface ChannelRow {
  name: string;
  color: string;
  kind: 'social' | 'web';
  followersText: string;
  reachText: string;
  rateText: string;
  enquiriesText: string;
  soldText: string;
  lastSync: string;
  followers: number;
  reach: number;
  engRate: number;
  enquiries: number;
  sold: number;
}

interface PostDef {
  title: string;
  channel: string;
  platformLabel: string;
  car: string;
  views: number;
  eng: number;
  enq: number;
}

interface Kpi {
  label: string;
  value: string;
  note: string;
  positive?: boolean;
  highlight?: boolean;
}

interface FunnelStage {
  label: string;
  value: string;
  note: string;
  width: number;
}

interface Suggestion {
  tag: string;
  tone: 'blue' | 'amber' | 'green';
  title: string;
  text: string;
  meta: string;
}

interface Source {
  name: string;
  detail: string;
  ok: boolean;
}

interface ChannelOption {
  id: string;
  name: string;
  color: string;
  hint: string;
}

const AVG_SALE_KES = 3_467_000;

@Component({
  selector: 'app-social-hub',
  imports: [],
  templateUrl: './social-hub.html',
  styleUrl: './social-hub.css',
})
export class SocialHub {
  /** Fires when the user clicks "Open customers" so the parent can navigate. */
  readonly openCustomers = output<void>();
  /** Fires with the suggestion title when the user plans a piece of content. */
  readonly contentPlanned = output<string>();

  // ---------- Date range ----------
  readonly ranges: RangeOption[] = [
    { key: '7', label: 'Last 7 days', days: 7, factor: 0.23, growth: 12, totalSales: 10 },
    { key: '30', label: 'Last 30 days', days: 30, factor: 1, growth: 18, totalSales: 45 },
    { key: '90', label: 'Last 90 days', days: 90, factor: 2.9, growth: 24, totalSales: 131 },
  ];
  readonly range = signal<RangeKey>('30');
  readonly rangeOpen = signal(false);
  readonly currentRange = computed(() => this.ranges.find((r) => r.key === this.range())!);

  // ---------- Channels ----------
  private readonly channels = signal<ChannelDef[]>([
    { name: 'YouTube', color: '#e11d1d', kind: 'social', followers: 18400, followersSuffix: ' subs', reach: 142000, rate: 5.8, enquiries: 52, sold: 4, lastSync: '12 min ago' },
    { name: 'TikTok', color: '#111111', kind: 'social', followers: 41200, reach: 186000, rate: 9.1, enquiries: 38, sold: 2, lastSync: '12 min ago' },
    { name: 'Instagram', color: '#a21caf', kind: 'social', followers: 12700, reach: 58000, rate: 6.4, enquiries: 29, sold: 2, lastSync: '14 min ago' },
    { name: 'Facebook', color: '#1d4ed8', kind: 'social', followers: 9800, reach: 26000, rate: 3.2, enquiries: 27, sold: 1, lastSync: '14 min ago' },
    { name: 'Website · GA4', color: '#0f766e', kind: 'web', followers: null, reach: 18200, reachSuffix: ' visits', rate: 3.4, rateSuffix: ' conv.', enquiries: null, sold: null, lastSync: '9 min ago' },
  ]);

  readonly channelSort = signal<{ key: ChannelSortKey; dir: SortDir } | null>(null);
  readonly activeChannel = signal<string | null>(null);

  private readonly scaled = computed(() => {
    const f = this.currentRange().factor;
    return this.channels().map((c) => ({
      ...c,
      reach: Math.round(c.reach * f),
      enquiries: c.enquiries === null ? null : Math.round(c.enquiries * f),
      sold: c.sold === null ? null : Math.round(c.sold * f),
    }));
  });

  readonly channelRows = computed<ChannelRow[]>(() => {
    const rows = this.scaled().map<ChannelRow>((c) => ({
      name: c.name,
      color: c.color,
      kind: c.kind,
      followersText: c.followers === null ? '—' : this.fmt(c.followers) + (c.followersSuffix ?? ''),
      reachText: this.fmt(c.reach) + (c.reachSuffix ?? ''),
      rateText: c.rate.toFixed(1) + '%' + (c.rateSuffix ?? ''),
      enquiriesText: c.enquiries === null ? '—' : String(c.enquiries),
      soldText: c.sold === null ? '—' : String(c.sold),
      lastSync: c.lastSync,
      followers: c.followers ?? -1,
      reach: c.reach,
      engRate: c.rate,
      enquiries: c.enquiries ?? -1,
      sold: c.sold ?? -1,
    }));
    const sort = this.channelSort();
    if (!sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  });

  // ---------- KPIs and funnel ----------
  private readonly totals = computed(() => {
    const r = this.currentRange();
    const social = this.scaled().filter((c) => c.kind === 'social');
    const reach = social.reduce((s, c) => s + c.reach, 0);
    const enquiries = social.reduce((s, c) => s + (c.enquiries ?? 0), 0);
    const sold = social.reduce((s, c) => s + (c.sold ?? 0), 0);
    return {
      reach,
      enquiries,
      sold,
      engaged: Math.round(28400 * r.factor),
      clicks: Math.round(3100 * r.factor),
      testDrives: Math.round(38 * r.factor),
      whatsapp: Math.round(62 * r.factor),
    };
  });

  readonly kpis = computed<Kpi[]>(() => {
    const r = this.currentRange();
    const t = this.totals();
    const engRate = t.reach ? ((t.engaged / t.reach) * 100).toFixed(1) : '0.0';
    const share = r.totalSales ? Math.round((t.sold / r.totalSales) * 100) : 0;
    return [
      { label: 'Social reach', value: this.fmt(t.reach), note: `▲ ${r.growth}% vs previous ${r.days} days`, positive: true },
      { label: 'Engagements', value: this.fmt(t.engaged), note: `▲ ${engRate}% engagement rate`, positive: true },
      { label: 'Enquiries from social', value: String(t.enquiries), note: `${t.whatsapp} WhatsApp · ${t.testDrives} test drives booked` },
      {
        label: 'Sales attributed to social',
        value: `${t.sold} ${t.sold === 1 ? 'car' : 'cars'}`,
        note: `KES ${((t.sold * AVG_SALE_KES) / 1_000_000).toFixed(1)}M · ${share}% of all sales`,
        highlight: true,
      },
    ];
  });

  readonly funnel = computed<FunnelStage[]>(() => {
    const t = this.totals();
    return [
      { label: 'Views and impressions', value: this.fmt(t.reach), note: '', width: 100 },
      { label: 'Engaged', value: this.fmt(t.engaged), note: `${this.pct(t.engaged, t.reach)} of views`, width: 76 },
      { label: 'Profile or link clicks', value: this.fmt(t.clicks), note: `${this.pct(t.clicks, t.engaged)} of engaged`, width: 56 },
      { label: 'Enquiries', value: String(t.enquiries), note: `${this.pct(t.enquiries, t.clicks)} of clicks`, width: 38 },
      { label: 'Test drives', value: String(t.testDrives), note: `${this.pct(t.testDrives, t.enquiries)} of enquiries`, width: 24 },
      { label: 'Cars sold', value: String(t.sold), note: `${this.pct(t.sold, t.testDrives)} of test drives`, width: 12 },
    ];
  });

  // ---------- Top content ----------
  private readonly posts: PostDef[] = [
    { title: 'Harrier 2021 full review · 9:40', channel: 'YouTube', platformLabel: 'YouTube', car: 'Toyota Harrier', views: 48200, eng: 7.1, enq: 31 },
    { title: 'Is the CX-5 worth KES 3.6M?', channel: 'TikTok', platformLabel: 'TikTok · 0:48', car: 'Mazda CX-5', views: 126000, eng: 9.4, enq: 22 },
    { title: 'Weekend yard open day', channel: 'Facebook', platformLabel: 'Facebook', car: 'Multiple cars', views: 33000, eng: 4.1, enq: 17 },
    { title: 'Hilux walkaround reel', channel: 'Instagram', platformLabel: 'Instagram', car: 'Toyota Hilux', views: 61000, eng: 6.2, enq: 14 },
  ];

  readonly postSort = signal<{ key: PostSortKey; dir: SortDir }>({ key: 'enq', dir: 'desc' });

  readonly postRows = computed(() => {
    const f = this.currentRange().factor;
    const channel = this.activeChannel();
    const sort = this.postSort();
    const dir = sort.dir === 'asc' ? 1 : -1;
    return this.posts
      .filter((p) => !channel || p.channel === channel)
      .map((p) => ({
        title: p.title,
        platformLabel: p.platformLabel,
        car: p.car,
        views: Math.round(p.views * f),
        eng: p.eng,
        enq: Math.round(p.enq * f),
      }))
      .sort((a, b) => (a[sort.key] - b[sort.key]) * dir)
      .map((p) => ({ ...p, viewsText: this.fmt(p.views), engText: p.eng.toFixed(1) + '%' }));
  });

  // ---------- Suggestions ----------
  readonly suggestions: Suggestion[] = [
    {
      tag: 'Selling fast',
      tone: 'blue',
      title: 'Review the Toyota Harrier on YouTube',
      text: 'Top enquiry car. Viewers are mostly men 25–40 in Nairobi and Kiambu. Reviews of this length hold attention best.',
      meta: 'YouTube · 8–10 min',
    },
    {
      tag: 'Aging stock',
      tone: 'amber',
      title: 'Short walkaround of the Toyota Hilux',
      text: '62 days on the lot. Pickup walkarounds do well on TikTok with buyers in Kajiado and Machakos.',
      meta: 'TikTok · 45–60 sec',
    },
    {
      tag: 'Trending search',
      tone: 'green',
      title: 'Harrier vs CX-5: which to buy?',
      text: 'Searches for this pair are up 40% this month. Pair a blog post with a short video.',
      meta: 'Blog + Reel · 30 sec',
    },
  ];
  readonly planned = signal<string[]>([]);

  // ---------- Sources ----------
  readonly sources = signal<Source[]>([
    { name: 'YouTube Data API', detail: 'Synced 12 min ago', ok: true },
    { name: 'TikTok for Business', detail: 'Synced 12 min ago', ok: true },
    { name: 'Meta · Facebook and Instagram', detail: 'Synced 14 min ago', ok: true },
    { name: 'Google Analytics and Search Console', detail: 'Synced 9 min ago', ok: true },
    { name: 'WhatsApp Business', detail: 'Token expires in 5 days · reconnect', ok: false },
    { name: 'A-Plus showroom records', detail: 'Walk-ins and sales · internal', ok: true },
  ]);
  readonly attentionCount = computed(() => this.sources().filter((s) => !s.ok).length);

  // ---------- Connect channel ----------
  private readonly allOptions: ChannelOption[] = [
    { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', hint: 'Company page' },
    { id: 'x', name: 'X (Twitter)', color: '#333333', hint: 'Business account' },
    { id: 'gbp', name: 'Google Business Profile', color: '#ea8600', hint: 'Showroom listing' },
    { id: 'pinterest', name: 'Pinterest', color: '#c8232c', hint: 'Business account' },
  ];
  private readonly connectedIds = signal<string[]>([]);
  readonly availableOptions = computed(() => this.allOptions.filter((o) => !this.connectedIds().includes(o.id)));
  readonly connectOpen = signal(false);
  readonly selectedOption = signal<string | null>(null);

  // ---------- Toast ----------
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  // ---------- Global listeners ----------
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.range')) this.rangeOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.rangeOpen.set(false);
    this.connectOpen.set(false);
  }

  // ---------- Actions ----------
  toggleRange(): void {
    this.rangeOpen.update((v) => !v);
  }

  setRange(key: RangeKey): void {
    this.range.set(key);
    this.rangeOpen.set(false);
  }

  sortChannels(key: ChannelSortKey): void {
    const cur = this.channelSort();
    this.channelSort.set(cur?.key === key ? { key, dir: cur.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  sortPosts(key: PostSortKey): void {
    const cur = this.postSort();
    this.postSort.set(cur.key === key ? { key, dir: cur.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  sortIndicator(current: { key: string; dir: SortDir } | null, key: string): string {
    if (current?.key !== key) return '↕';
    return current.dir === 'desc' ? '↓' : '↑';
  }

  ariaSort(current: { key: string; dir: SortDir } | null, key: string): 'ascending' | 'descending' | 'none' {
    if (current?.key !== key) return 'none';
    return current.dir === 'desc' ? 'descending' : 'ascending';
  }

  toggleChannel(row: ChannelRow): void {
    if (row.kind !== 'social') return;
    this.activeChannel.update((cur) => (cur === row.name ? null : row.name));
  }

  clearChannel(): void {
    this.activeChannel.set(null);
  }

  isPlanned(title: string): boolean {
    return this.planned().includes(title);
  }

  plan(s: Suggestion): void {
    if (this.isPlanned(s.title)) {
      this.planned.update((list) => list.filter((t) => t !== s.title));
      this.showToast('Removed from your content plan');
      return;
    }
    this.planned.update((list) => [...list, s.title]);
    this.contentPlanned.emit(s.title);
    this.showToast(`Added to your content plan: ${s.title}`);
  }

  reconnect(name: string): void {
    this.sources.update((list) =>
      list.map((s) => (s.name === name ? { ...s, ok: true, detail: 'Synced just now' } : s)),
    );
    this.showToast(`${name} reconnected`);
  }

  openConnect(): void {
    this.selectedOption.set(null);
    this.connectOpen.set(true);
  }

  closeConnect(): void {
    this.connectOpen.set(false);
  }

  connectSelected(): void {
    const option = this.allOptions.find((o) => o.id === this.selectedOption());
    if (!option) return;
    this.connectedIds.update((ids) => [...ids, option.id]);
    this.channels.update((list) => [
      ...list,
      {
        name: option.name,
        color: option.color,
        kind: 'social',
        followers: 0,
        reach: 0,
        rate: 0,
        enquiries: 0,
        sold: 0,
        lastSync: 'Just now',
      },
    ]);
    this.sources.update((list) => [
      ...list,
      { name: option.name, detail: 'Synced just now', ok: true },
    ]);
    this.connectOpen.set(false);
    this.showToast(`${option.name} connected. The first full sync can take a few minutes.`);
  }

  goToCustomers(): void {
    this.openCustomers.emit();
  }

  dismissToast(): void {
    this.toast.set(null);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }

  // ---------- Helpers ----------
  private fmt(n: number): string {
    const trim = (v: string) => v.replace(/\.0$/, '');
    if (n >= 1_000_000) return trim((n / 1_000_000).toFixed(1)) + 'M';
    if (n >= 100_000) return Math.round(n / 1000) + 'K';
    if (n >= 1000) return trim((n / 1000).toFixed(1)) + 'K';
    return String(n);
  }

  private pct(part: number, whole: number): string {
    if (!whole) return '0%';
    const v = (part / whole) * 100;
    return (v >= 20 ? Math.round(v) : Math.round(v * 10) / 10) + '%';
  }
}