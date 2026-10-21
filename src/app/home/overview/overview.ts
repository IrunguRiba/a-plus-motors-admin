import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Clip {
  vid: string;
}

@Component({
  selector: 'app-overview',
  imports: [CommonModule],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview implements OnInit, OnDestroy {
  stewie = 'ste.gif';
  isMuted = true;
  title = 'OVERVIEW COMING SOON !';
audio='audio-speaker.png'
  clips: Clip[] = [
    { vid: '1.mp4' },
    { vid: '2.mp4' },
    { vid: '3.mp4' },
    { vid: '4.mp4' },
    { vid: '5.mp4' },
  ];

  currentVid = this.clips[0].vid;
  showComingSoon = false;

  private nextTimeoutId?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.playRandom();
  }

  ngOnDestroy(): void {
    if (this.nextTimeoutId) clearTimeout(this.nextTimeoutId);
  }
  onVideoEnded(): void {
    this.showComingSoon = true;
    this.nextTimeoutId = setTimeout(() => {
      this.showComingSoon = false;
      this.playRandom();
    }, 1000);
  }

  playRandom(): void {
    if (this.clips.length < 2) {
      this.currentVid = this.clips[0].vid;
      return;
    }
    let next = this.currentVid;
    while (next === this.currentVid) {
      next = this.clips[Math.floor(Math.random() * this.clips.length)].vid;
    }
    this.currentVid = next;
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
  }
}