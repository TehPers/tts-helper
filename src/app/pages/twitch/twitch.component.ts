import { Component } from '@angular/core';
import { SubsComponent } from './subs/subs.component';
import { BitsComponent } from './bits/bits.component';
import { RedeemsComponent } from './redeems/redeems.component';
import { AuthComponent } from './auth/auth.component';

@Component({
  selector: 'app-twitch',
  templateUrl: './twitch.component.html',
  styleUrls: ['./twitch.component.scss'],
  standalone: true,
  imports: [AuthComponent, RedeemsComponent, BitsComponent, SubsComponent],
})
export class TwitchComponent {}
