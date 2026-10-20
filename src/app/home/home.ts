import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Search } from '../home/search/search';

@Component({
  selector: 'app-home',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Search],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
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

  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const menu = this.userMenu()?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  logout(): void {
    this.closeMenu();
    this.router.navigate(['/login']);
  }
}