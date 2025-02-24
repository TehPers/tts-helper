import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectAuditItems } from '../state/history/history.selectors';
import {
  AuditItem,
  AuditSource,
  AuditState,
} from '../state/history/history-item.interface';
import {
  addHistory,
  updateHistoryStatus,
} from '../state/history/history.actions';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from './config.service';
import {
  AmazonPollyData,
  StreamElementsData,
  TtsMonsterData,
  TtsType,
} from '../state/config/config.interface';

import { PollyClient } from '@aws-sdk/client-polly';
import { getSynthesizeSpeechUrl } from '@aws-sdk/polly-request-presigner';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { TtsOptions } from './history.interface';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable()
export class HistoryService {
  public readonly auditItems$ = this.store.select(selectAuditItems);
  bannedWords: string[] = [];

  tts: TtsType = 'stream-elements';
  apiUrl = '';
  deviceId = '';
  deviceVolume = 100;
  streamElements!: StreamElementsData;
  ttsMonster!: TtsMonsterData;
  amazonPolly!: AmazonPollyData;

  constructor(
    private readonly store: Store,
    private readonly configService: ConfigService,
    private readonly snackbar: MatSnackBar
  ) {
    this.configService.configTts$
      .pipe(takeUntilDestroyed())
      .subscribe((tts) => (this.tts = tts));

    this.configService.deviceVolume$
      .pipe(takeUntilDestroyed())
      .subscribe((volume) => (this.deviceVolume = volume));

    this.configService.selectedDevice$
      .pipe(takeUntilDestroyed())
      .subscribe((device) => (this.deviceId = device));

    this.configService.configUrl$
      .pipe(takeUntilDestroyed())
      .subscribe((url) => (this.apiUrl = url));

    this.configService.bannedWords$
      .pipe(takeUntilDestroyed())
      .subscribe((bannedWords) => (this.bannedWords = bannedWords));

    this.configService.streamElements$
      .pipe(takeUntilDestroyed())
      .subscribe((streamElements) => (this.streamElements = streamElements));

    this.configService.ttsMonster$
      .pipe(takeUntilDestroyed())
      .subscribe((ttsMonster) => (this.ttsMonster = ttsMonster));

    this.configService.amazonPolly$
      .pipe(takeUntilDestroyed())
      .subscribe((amazonPolly) => (this.amazonPolly = amazonPolly));

    listen('audio-done', (item) => {
      this.store.dispatch(
        updateHistoryStatus({
          id: item.payload as number,
          auditState: AuditState.finished,
        })
      );
    });
  }

  requeue(audit: AuditItem) {
    /**
     * @TODO - Determine if not having a character limit on requeue is good or bad.
     */
    this.playTts(audit.text, audit.username, audit.source, 1000, audit.id);
  }

  async playTts(
    text: string,
    username: string,
    source: AuditSource,
    charLimit: number,
    auditId?: number
  ) {
    if (this.bannedWords.find((w) => text.toLowerCase().includes(w))) {
      return;
    }

    // Trim played audio down, but keep full message incase stream wants to requeue it.
    const audioText = text.substring(0, charLimit);

    const ttsOptions: TtsOptions = {
      audioText,
      text,
      source,
      username,
      auditId,
      params: [],
    };

    switch (this.tts) {
      case 'amazon-polly':
        this.handleAmazonPolly(ttsOptions);
        break;
      case 'stream-elements': {
        const params: [string, string][] = [
          ['voice', this.streamElements.voice],
          ['text', audioText],
        ];

        this.handleTtsInvoke({ ...ttsOptions, params });
        break;
      }
    }
  }

  async handleAmazonPolly(options: TtsOptions) {
    const { audioText } = options;

    if (!this.amazonPolly.poolId) {
      this.snackbar.open(
        `Oops! You didn't provide a Pool ID for Amazon Polly.`,
        'Dismiss',
        {
          panelClass: 'notification-error',
        }
      );
      return;
    }

    const pollyParams = {
      OutputFormat: 'mp3',
      SampleRate: '22050',
      Text: audioText,
      TextType: 'text',
      VoiceId: this.amazonPolly.voice,
    };

    try {
      const url = await getSynthesizeSpeechUrl({
        client: new PollyClient({
          region: this.amazonPolly.region,
          credentials: fromCognitoIdentityPool({
            clientConfig: {
              region: this.amazonPolly.region,
            },
            identityPoolId: this.amazonPolly.poolId,
          }),
        }),
        params: pollyParams,
      });

      this.apiUrl = url.toString();
      this.handleTtsInvoke(options);
    } catch (e) {
      this.snackbar.open(
        `Oops! We had issues communicating with Polly!`,
        'Dismiss',
        {
          panelClass: 'notification-error',
        }
      );
      return console.error('Failed to get Amazon Polly url', e);
    }
  }

  handleTtsInvoke(options: TtsOptions) {
    const { text, audioText, source, username, params, auditId } = options;

    invoke('play_tts', {
      request: {
        id: auditId,
        device: this.deviceId,
        volume: this.deviceVolume,
        tts: this.tts,
        url: this.apiUrl,
        params,
      },
    })
      .then((id) =>
        this.handleNewHistory({
          id: Number(id),
          text,
          audioText,
          source,
          username,
          auditId,
        })
      )
      .catch((e) => {
        console.error(`Error invoking play_tts`, e);
        this.snackbar.open(
          'Oops! We encountered an error while playing that.',
          'Dismiss',
          {
            panelClass: 'notification-error',
          }
        );
      });
  }

  handleNewHistory(options: TtsOptions) {
    if (typeof options.id != 'number') {
      throw new Error(`Unexpected response type: ${typeof options.id}`);
    }

    if (options.auditId !== undefined) {
      return;
    }

    this.addHistory({
      id: options.id,
      createdAt: new Date(),
      source: options.source,
      text: options.text ?? '[No TTS text found]',
      username: options.username,
      state: AuditState.playing,
    });
  }

  addHistory(audit: AuditItem) {
    return this.store.dispatch(addHistory({ audit }));
  }

  updateHistory(id: number, auditState: AuditState) {
    return this.store.dispatch(updateHistoryStatus({ id, auditState }));
  }
}
