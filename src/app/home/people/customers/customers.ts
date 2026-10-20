import { Component, ElementRef, computed, output, signal, viewChild } from '@angular/core';

interface JourneyEvent {
  when: string;
  channel: string;
  text: string;
  current?: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  source: string;
  car: string;
  budget: string;
  stage: string;
  last: string;
  salesperson: string;
  location: string;
  age: string;
  financing: string;
  headline: string;
  journey: JourneyEvent[];
  action: { title: string; body: string };
}

@Component({
  selector: 'app-customers',
  imports: [],
  templateUrl: './customers.html',
  styleUrl: './customers.css',
})
export class Customers {
  readonly stats = [
    { label: 'Total contacts', value: '1,248', note: '612 walk-in · 636 online', up: false, highlight: false },
    { label: 'New this week', value: '64', note: '41 walk-in · 23 online', up: true, highlight: false },
    { label: 'Walk-ins this month', value: '212', note: '58 had seen a video first', up: false, highlight: false },
    { label: 'Sales that started online', value: '38%', note: 'of deals closed this quarter', up: false, highlight: true },
  ];

  readonly chips = ['All', 'Walk-in', 'WhatsApp', 'YouTube', 'TikTok', 'Instagram', 'Facebook'];

  readonly stages = ['New', 'Enquiry', 'Financing', 'Test drive', 'Negotiating'];

  readonly cars = [
    'Toyota Harrier 2021',
    'Toyota Hilux 2020',
    'Mazda CX-5 2020',
    'Honda Fit 2018',
    'Mercedes C200 2019',
    'Subaru Forester 2019',
    'Nissan X-Trail 2018',
  ];

  readonly heardOptions = ['YouTube', 'TikTok', 'Instagram', 'Facebook', 'Google', 'Friend or family', 'Passing by'];

  private readonly colors: Record<string, string> = {
    YouTube: '#dc2626',
    TikTok: '#0a0a0a',
    Instagram: '#a21caf',
    Facebook: '#2563eb',
    WhatsApp: '#16a34a',
    Google: '#1a4fd8',
    'Walk-in': '#6b7280',
    Showroom: '#6b7280',
    Note: '#6b7280',
  };

  readonly customers = signal<Customer[]>([
    {
      id: 'c1', name: 'Grace Njeri', phone: '0712 ••• 482', source: 'YouTube', car: 'Toyota Harrier 2021',
      budget: '4.0M – 4.5M', stage: 'Test drive', last: 'Today 09:20', salesperson: 'Mary Wanjiru',
      location: 'Kiambu', age: '30–39', financing: 'Pre-check pending',
      headline: 'Test drive today 14:00 · Mary Wanjiru',
      journey: [
        { when: '12 Oct', channel: 'YouTube', text: 'Watched the Harrier review for 7 min of 9:40.' },
        { when: '13 Oct', channel: 'Instagram', text: 'Saved the Harrier reel and commented asking if the price is negotiable.' },
        { when: '15 Oct', channel: 'WhatsApp', text: 'Asked about financing and deposit.' },
        { when: '17 Oct', channel: 'Showroom', text: 'Walk-in. Viewed the Harrier and the CX-5.' },
        { when: 'Today', channel: 'Showroom', text: 'Test drive booked for 14:00 with Mary Wanjiru.', current: true },
      ],
      action: {
        title: 'Offer a Stanbic Bank pre-check after the test drive.',
        body: 'A 20% deposit on this car is KES 850,000. Her comments asked about price and financing.',
      },
    },
    {
      id: 'c2', name: 'Brian Otieno', phone: '0723 ••• 915', source: 'Walk-in', car: 'Toyota Hilux 2020',
      budget: '4.5M – 5.0M', stage: 'Negotiating', last: 'Yesterday', salesperson: 'Peter Kamau',
      location: 'Machakos', age: '40–49', financing: 'Approved in principle',
      headline: 'Negotiating · Peter Kamau',
      journey: [
        { when: '14 Oct', channel: 'Showroom', text: 'Walk-in. Viewed the Hilux and two other pickups.' },
        { when: '17 Oct', channel: 'WhatsApp', text: 'Asked for photos of the load bed and the service history.' },
        { when: 'Yesterday', channel: 'WhatsApp', text: 'Asked for the best cash price.', current: true },
      ],
      action: {
        title: 'Send a written offer on the Hilux today.',
        body: 'He asked for the best cash price yesterday and this stock has been on the yard over 60 days.',
      },
    },
    {
      id: 'c3', name: 'Faith Mwende', phone: '0734 ••• 208', source: 'TikTok', car: 'Mazda CX-5 2020',
      budget: '3.5M – 3.8M', stage: 'Enquiry', last: '2 days ago', salesperson: 'Mary Wanjiru',
      location: 'Nairobi', age: '25–34', financing: 'Not started',
      headline: 'Enquiry · Mary Wanjiru',
      journey: [
        { when: '15 Oct', channel: 'TikTok', text: 'Watched the CX-5 feature clip twice.' },
        { when: '16 Oct', channel: 'TikTok', text: 'Commented asking for the mileage.' },
        { when: '18 Oct', channel: 'WhatsApp', text: 'Received the mileage and photos.', current: true },
      ],
      action: {
        title: 'Invite her for a test drive this weekend.',
        body: 'She has seen the clip and has the mileage. The next step is seeing the car.',
      },
    },
    {
      id: 'c4', name: 'Dennis Kiprop', phone: '0745 ••• 631', source: 'Facebook', car: 'Honda Fit 2018',
      budget: '1.2M – 1.5M', stage: 'Financing', last: '3 days ago', salesperson: 'Peter Kamau',
      location: 'Nairobi', age: '22–29', financing: 'Application submitted',
      headline: 'Financing · Peter Kamau',
      journey: [
        { when: '10 Oct', channel: 'Facebook', text: 'Watched the Honda Fit yard update.' },
        { when: '14 Oct', channel: 'Showroom', text: 'Walk-in. Viewed the Fit and asked about instalments.' },
        { when: '17 Oct', channel: 'WhatsApp', text: 'Financing application submitted.', current: true },
      ],
      action: {
        title: 'Follow up on the financing decision.',
        body: 'The application went in 3 days ago. Share the monthly instalment while he waits.',
      },
    },
    {
      id: 'c5', name: 'Aisha Hassan', phone: '0756 ••• 077', source: 'Instagram', car: 'Mercedes C200 2019',
      budget: '5.0M – 5.5M', stage: 'Test drive', last: '3 days ago', salesperson: 'Mary Wanjiru',
      location: 'Mombasa', age: '25–34', financing: 'Cash buyer',
      headline: 'Test drive this week · Mary Wanjiru',
      journey: [
        { when: '9 Oct', channel: 'Instagram', text: 'Saved the C200 reel and shared it.' },
        { when: '13 Oct', channel: 'WhatsApp', text: 'Asked about the service history and colour options.' },
        { when: '17 Oct', channel: 'WhatsApp', text: 'Asked to book a test drive.', current: true },
      ],
      action: {
        title: 'Confirm the test drive time.',
        body: 'She asked to book 3 days ago and is travelling from Mombasa, so confirm a slot early.',
      },
    },
    {
      id: 'c6', name: 'Samuel Mutua', phone: '0767 ••• 344', source: 'Walk-in', car: 'Subaru Forester 2019',
      budget: '2.8M – 3.0M', stage: 'New', last: '4 days ago', salesperson: 'Unassigned',
      location: 'Kiambu', age: '30–39', financing: 'Not started',
      headline: 'New walk-in · Unassigned',
      journey: [{ when: '16 Oct', channel: 'Showroom', text: 'Walk-in. Viewed the Forester.', current: true }],
      action: {
        title: 'Assign a salesperson.',
        body: 'He walked in 4 days ago and no one has followed up yet.',
      },
    },
    {
      id: 'c7', name: 'Lucy Wairimu', phone: '0778 ••• 120', source: 'WhatsApp', car: 'Nissan X-Trail 2018',
      budget: '2.5M – 2.8M', stage: 'Enquiry', last: '5 days ago', salesperson: 'Peter Kamau',
      location: 'Nairobi', age: '35–44', financing: 'Not started',
      headline: 'Enquiry · Peter Kamau',
      journey: [
        { when: '14 Oct', channel: 'Facebook', text: 'Clicked the X-Trail post.' },
        { when: '15 Oct', channel: 'WhatsApp', text: 'Asked if the X-Trail is still available.', current: true },
      ],
      action: {
        title: 'Reply with photos and a viewing slot.',
        body: 'She asked about availability 5 days ago and has not had a full reply.',
      },
    },
  ]);

  readonly customerSelected = output<Customer>();
  readonly walkInSaved = output<Customer>();
  readonly noteLogged = output<{ customer: Customer; note: string }>();
  readonly financingOfferSent = output<Customer>();

  readonly quickAdd = viewChild<ElementRef<HTMLElement>>('quickAdd');
  readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  readonly query = signal('');
  readonly channel = signal('All');
  readonly stageFilter = signal('all');
  readonly salespersonFilter = signal('all');
  readonly filtersOpen = signal(false);
  readonly page = signal(1);
  readonly pageSize = 7;
  readonly selectedId = signal('c1');
  readonly note = signal('');
  readonly toast = signal<string | null>(null);

  readonly formName = signal('');
  readonly formPhone = signal('');
  readonly formCar = signal(this.cars[0]);
  readonly formBudget = signal('');
  readonly formHeard = signal('YouTube');
  readonly submitted = signal(false);

  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  readonly salespeople = computed(() => ['all', ...Array.from(new Set(this.customers().map(c => c.salesperson)))]);

  readonly counts = computed(() => {
    const list = this.customers();
    const result: Record<string, number> = { All: list.length };
    for (const chip of this.chips.slice(1)) {
      result[chip] = list.filter(c => c.source === chip).length;
    }
    return result;
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const channel = this.channel();
    const stage = this.stageFilter();
    const person = this.salespersonFilter();
    return this.customers().filter(c => {
      const matchesQuery = !q || [c.name, c.phone, c.car].some(v => v.toLowerCase().includes(q));
      return (
        matchesQuery &&
        (channel === 'All' || c.source === channel) &&
        (stage === 'all' || c.stage === stage) &&
        (person === 'all' || c.salesperson === person)
      );
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  readonly paged = computed(() => {
    const start = (Math.min(this.page(), this.totalPages()) - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly showingText = computed(() => {
    const total = this.filtered().length;
    if (!total) return 'Showing 0 of 0';
    const start = (Math.min(this.page(), this.totalPages()) - 1) * this.pageSize + 1;
    return `Showing ${start}–${start + this.paged().length - 1} of ${total.toLocaleString('en-US')}`;
  });

  readonly activeFilterCount = computed(
    () => (this.stageFilter() !== 'all' ? 1 : 0) + (this.salespersonFilter() !== 'all' ? 1 : 0),
  );

  readonly selected = computed(() => this.customers().find(c => c.id === this.selectedId()) ?? this.customers()[0]);

  readonly nameError = computed(() => (this.submitted() && this.formName().trim().length < 2 ? 'Enter the full name' : ''));
  readonly phoneError = computed(() =>
    this.submitted() && !/^(07|01)\d{8}$/.test(this.formPhone().replace(/\s/g, '')) ? 'Enter a 10 digit number starting with 07 or 01' : '',
  );

  color(channel: string): string {
    return this.colors[channel] ?? '#6b7280';
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  stageClass(stage: string): string {
    return stage.toLowerCase().replace(/\s+/g, '-');
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  setChannel(chip: string): void {
    this.channel.set(chip);
    this.page.set(1);
  }

  toggleFilters(): void {
    this.filtersOpen.update(open => !open);
  }

  setStageFilter(event: Event): void {
    this.stageFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  setSalespersonFilter(event: Event): void {
    this.salespersonFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  resetFilters(): void {
    this.query.set('');
    this.channel.set('All');
    this.stageFilter.set('all');
    this.salespersonFilter.set('all');
    this.page.set(1);
  }

  goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.note.set('');
    this.customerSelected.emit(this.selected());
  }

  onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  logNote(): void {
    const text = this.note().trim();
    if (!text) return;
    const customer = this.selected();
    this.update(customer.id, c => ({
      journey: [...c.journey.map(e => ({ ...e, current: false })), { when: 'Today', channel: 'Note', text, current: true }],
    }));
    this.noteLogged.emit({ customer: this.selected(), note: text });
    this.note.set('');
    this.showToast('Note logged');
  }

  sendFinancingOffer(): void {
    const customer = this.selected();
    this.update(customer.id, c => ({
      financing: 'Offer sent',
      journey: [
        ...c.journey.map(e => ({ ...e, current: false })),
        { when: 'Today', channel: 'WhatsApp', text: 'Financing offer sent.', current: true },
      ],
    }));
    this.financingOfferSent.emit(this.selected());
    this.showToast(`Financing offer sent to ${customer.name}`);
  }

  exportCsv(): void {
    const header = ['Name', 'Phone', 'First saw us on', 'Interested in', 'Budget (KES)', 'Stage', 'Last touch', 'Salesperson'];
    const rows = this.filtered().map(c => [c.name, c.phone, c.source, c.car, c.budget, c.stage, c.last, c.salesperson]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers.csv';
    link.click();
    URL.revokeObjectURL(url);
    this.showToast(`Exported ${rows.length} contacts`);
  }

  focusQuickAdd(): void {
    this.quickAdd()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => this.nameInput()?.nativeElement.focus(), 350);
  }

  onName(event: Event): void {
    this.formName.set((event.target as HTMLInputElement).value);
  }

  onPhone(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean);
    const formatted = parts.join(' ');
    input.value = formatted;
    this.formPhone.set(formatted);
  }

  onCar(event: Event): void {
    this.formCar.set((event.target as HTMLSelectElement).value);
  }

  onBudget(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    const formatted = digits ? Number(digits).toLocaleString('en-US') : '';
    input.value = formatted;
    this.formBudget.set(formatted);
  }

  setHeard(option: string): void {
    this.formHeard.set(option);
  }

  clearForm(): void {
    this.formName.set('');
    this.formPhone.set('');
    this.formCar.set(this.cars[0]);
    this.formBudget.set('');
    this.formHeard.set('YouTube');
    this.submitted.set(false);
  }

  saveWalkIn(): void {
    this.submitted.set(true);
    if (this.nameError() || this.phoneError() || this.formName().trim().length < 2 || !this.formPhone()) return;

    const digits = this.formPhone().replace(/\s/g, '');
    if (!/^(07|01)\d{8}$/.test(digits)) return;

    const heard = this.formHeard();
    const source = ['YouTube', 'TikTok', 'Instagram', 'Facebook', 'Google'].includes(heard) ? heard : 'Walk-in';
    const budgetNumber = Number(this.formBudget().replace(/,/g, ''));
    const car = this.formCar();
    const customer: Customer = {
      id: `c${Date.now()}`,
      name: this.formName().trim(),
      phone: `${digits.slice(0, 4)} ••• ${digits.slice(-3)}`,
      source,
      car,
      budget: budgetNumber ? `${(budgetNumber / 1_000_000).toFixed(1)}M` : 'Not given',
      stage: 'New',
      last: 'Just now',
      salesperson: 'Unassigned',
      location: 'Not given',
      age: 'Not given',
      financing: 'Not started',
      headline: 'New walk-in · Unassigned',
      journey: [{ when: 'Today', channel: 'Showroom', text: `Walk-in. Asked about the ${car}. Heard about us: ${heard}.`, current: true }],
      action: { title: 'Assign a salesperson.', body: 'A new walk-in has no follow-up yet. Assign someone before the end of the day.' },
    };

    this.customers.update(list => [customer, ...list]);
    this.channel.set('All');
    this.query.set('');
    this.page.set(1);
    this.selectedId.set(customer.id);
    this.walkInSaved.emit(customer);
    this.clearForm();
    this.showToast(`${customer.name} saved as a walk-in`);
  }

  private update(id: string, change: (c: Customer) => Partial<Customer>): void {
    this.customers.update(list => list.map(c => (c.id === id ? { ...c, ...change(c) } : c)));
  }

  private showToast(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }
}