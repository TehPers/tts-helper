import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home.component';
import { RouterModule } from '@angular/router';
import { InputModule } from '../../shared/components/input/input.module';
import { ButtonModule } from '../../shared/components/button/button.module';
import { SelectModule } from '../../shared/components/select/select.module';
import { ToggleModule } from '../../shared/components/toggle/toggle.module';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { HistoryService } from 'src/app/shared/services/history.service';

@NgModule({
  declarations: [HomeComponent],
  imports: [
    CommonModule,
    InputModule,
    MatFormFieldModule,
    FormsModule,
    MatSnackBarModule,
    ButtonModule,
    SelectModule,
    ToggleModule,
    RouterModule.forChild([
      {
        path: '',
        component: HomeComponent,
      },
    ]),
    RouterModule,
  ],
  exports: [HomeComponent],
  providers: [HistoryService],
})
export class HomeModule {}
