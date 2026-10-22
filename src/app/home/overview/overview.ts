import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-overview',
  imports: [CommonModule],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview implements AfterViewInit, OnDestroy {
  @ViewChild('bgVideo') bgVideoRef!: ElementRef<HTMLVideoElement>;

  stewie = 'ste.gif';
  isMuted = true;
  title = 'OVERVIEW COMING SOON !';
  audio = 'audio-speaker.png';

  private clipSource = '5.mp4';

  ngAfterViewInit(): void {
    this.playVid();
  }

  playVid(): string {
    return this.clipSource;
  }

  private tryPlay(): void {
    const el = this.bgVideoRef?.nativeElement;
    if (!el) return;

    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        console.warn('Autoplay blocked, retrying muted:', err?.name);
        el.muted = true;
        this.isMuted = true;
        el.play().catch((e2) => console.error('Retry failed:', e2));
      });
    }
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    const el = this.bgVideoRef?.nativeElement;
    if (el) {
      el.muted = this.isMuted;
      if (!this.isMuted) {
        el.play().catch(() => {});
      }
    }
  }

  onVideoEnded(): void {
    const el = this.bgVideoRef?.nativeElement;
    if (el) { el.currentTime = 0; this.tryPlay(); }
  }

  ngOnDestroy(): void {
    const el = this.bgVideoRef?.nativeElement;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }
}