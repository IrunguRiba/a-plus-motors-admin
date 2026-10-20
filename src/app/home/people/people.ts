import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
@Component({
  selector: 'app-people',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './people.html',
  styleUrl: './people.css',
})
export class People {}
