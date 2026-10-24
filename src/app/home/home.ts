import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Search } from '../home/search/search';

@Component({
  selector: 'app-home',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Search],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnDestroy {
  private readonly router = inject(Router);

  readonly searchComp = viewChild.required(Search);
  readonly userMenu = viewChild<ElementRef<HTMLElement>>('userMenu');

  readonly menuOpen = signal(false);

  readonly user = {
    name: 'Joel Irungu',
    initials: 'JI',
    role: 'Admin',
    yard: 'Main yard',
    email: 'joel@aplusmotors.co.ke',
  };

  private readonly onDocumentClick = (event: MouseEvent) => this.handleDocumentClick(event);
  private readonly onKeydown = (event: KeyboardEvent) => this.handleKeydown(event);

  constructor(@Inject(DOCUMENT) private readonly doc: Document) {
    this.doc.addEventListener('click', this.onDocumentClick);
    this.doc.addEventListener('keydown', this.onKeydown);
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('click', this.onDocumentClick);
    this.doc.removeEventListener('keydown', this.onKeydown);
  }

  openSearch(): void {
    this.closeMenu();
    this.searchComp().show();
  }

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  // ---------- keyboard shortcut: Ctrl+1 -> Overview ----------
  private handleKeydown(event: KeyboardEvent): void {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.code !== 'Digit1') return;
    if (this.isEditableTarget(event.target)) return;

    event.preventDefault();
    this.closeMenu();
    this.router.navigate(['overview']);
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
  }

  // ---------- outside-click handler for user menu ----------
  private handleDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const menu = this.userMenu()?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) {
      this.closeMenu();
    }
  }
}