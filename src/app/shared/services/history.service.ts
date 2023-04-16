import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectAuditItems } from '../state/history/history.selectors';
import { AuditItem, AuditSource, AuditState } from '../state/history/history-item.interface';
import {
  addHistory,
  updateHistoryStatus,
} from '../state/history/history.actions';
import { listen } from '@tauri-apps/api/event';
import { invoke } from "@tauri-apps/api/tauri";
import { MatSnackBar } from "@angular/material/snack-bar";

@Injectable()
export class HistoryService {
  public readonly auditItems$ = this.store.select(selectAuditItems);

  constructor(
    private readonly store: Store,
    private readonly snackbar: MatSnackBar
  ) {
    listen('audio-done', (item) => {
      this.store.dispatch(
        updateHistoryStatus({
          id: item.payload as number,
          auditState: AuditState.finished,
        })
      );
    });
  }
  
  playTts(text: string, username: string, source: AuditSource) {
    invoke('play_tts', {
      /**
       * @TODO - Setup state for handling selected TTS options
       */
      request: {
        url: 'https://api.streamelements.com/kappa/v2/speech',
        params: [
          ['voice', 'Brian'],
          ['text', text],
        ],
      },
    })
      .then((id) => {
        if (typeof id != 'number') {
          throw new Error(`Unexpected response type: ${typeof id}`);
        }

        this.addHistory({
          id,
          createdAt: new Date(),
          source,
          text: text ?? '[No TTS text found]',
          username,
          state: AuditState.playing,
        });
      })
      .catch((e) => {
        console.error(`Error invoking play_tts: ${e}`);

        this.snackbar.open(
          'Oops! We encountered an error while playing that.',
          'Dismiss',
          {
            panelClass: 'notification-error',
          }
        );
      });
  }

  addHistory(audit: AuditItem) {
    return this.store.dispatch(addHistory({ audit }));
  }

  updateHistory(id: number, auditState: AuditState) {
    return this.store.dispatch(updateHistoryStatus({ id, auditState }));
  }
}
