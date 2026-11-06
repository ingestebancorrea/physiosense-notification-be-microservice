import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Notification } from '../../notifications/entities/notification.entity';
import { DeviceToken } from '../../devices/entities/device-token.entity';
import {
  NotificationChannel,
  NotificationPriority,
} from '../../common/enums/notification.enums';

export interface FirebaseStatus {
  configured: boolean;
  projectId?: string;
  source?: string;
  error?: string;
}

interface ServiceAccountJson {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
}

type CredentialResult =
  | {
      ok: true;
      credential: ReturnType<typeof admin.credential.cert>;
      projectId: string;
      source: string;
    }
  | { ok: false; reason: string };

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private messaging?: admin.messaging.Messaging;
  private androidChannelId?: string;
  private status: 'not-configured' | 'configured' | 'error' = 'not-configured';
  private projectId?: string;
  private source?: string;
  private statusMessage?: string;

  constructor(private configService: ConfigService) {
    this.androidChannelId = this.configService
      .get<string>('ANDROID_NOTIFICATION_CHANNEL_ID')
      ?.trim();
    this.initializeFirebase();
  }

  /**
   * Credential resolution order:
   * 1. FIREBASE_SERVICE_ACCOUNT_PATH (or GOOGLE_APPLICATION_CREDENTIALS): path to the service account JSON.
   * 2. FIREBASE_SERVICE_ACCOUNT: full JSON (or base64-encoded JSON) in a single env var.
   * 3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
   */
  private initializeFirebase() {
    try {
      const result = this.resolveCredential();

      if (!result.ok) {
        this.statusMessage = result.reason;
        this.logger.warn(`Push notifications disabled: ${result.reason}`);
        return;
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: result.credential,
          projectId: result.projectId,
        });
      }

      this.messaging = admin.messaging();
      this.projectId = result.projectId;
      this.source = result.source;
      this.status = 'configured';

      this.logger.log(
        `Firebase initialized (source: ${result.source}, project: ${result.projectId})`,
      );
    } catch (error) {
      this.status = 'error';
      this.statusMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to initialize Firebase: ${this.statusMessage}. Push notifications will not work.`,
      );
    }
  }

  getStatus(): FirebaseStatus {
    return {
      configured: this.status === 'configured',
      ...(this.projectId ? { projectId: this.projectId } : {}),
      ...(this.source ? { source: this.source } : {}),
      ...(this.statusMessage ? { error: this.statusMessage } : {}),
    };
  }

  isConfigured(): boolean {
    return this.status === 'configured';
  }

  private resolveCredential(): CredentialResult {
    const serviceAccountPath =
      this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH') ||
      this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

    if (serviceAccountPath) {
      return this.credentialFromFile(serviceAccountPath);
    }

    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (serviceAccountJson) {
      return this.credentialFromJson(serviceAccountJson, 'FIREBASE_SERVICE_ACCOUNT');
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID')?.trim();
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL')?.trim();
    const privateKey = this.normalizePrivateKey(
      this.configService.get<string>('FIREBASE_PRIVATE_KEY'),
    );

    if (!projectId && !clientEmail && !privateKey) {
      return {
        ok: false,
        reason:
          'No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_PATH (recommended) or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.',
      };
    }

    if (!projectId || !clientEmail || !privateKey) {
      return {
        ok: false,
        reason:
          'Incomplete Firebase credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must all be set.',
      };
    }

    if (this.isPlaceholder(projectId) || this.isPlaceholder(clientEmail)) {
      return {
        ok: false,
        reason:
          'Firebase credentials are placeholders. Replace them with the real values from the service account JSON.',
      };
    }

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      return {
        ok: false,
        reason:
          'FIREBASE_PRIVATE_KEY does not look like a PEM private key (missing "BEGIN PRIVATE KEY").',
      };
    }

    return {
      ok: true,
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
      source: 'environment variables',
    };
  }

  private credentialFromFile(path: string): CredentialResult {
    const resolvedPath = resolve(process.cwd(), path);

    if (!existsSync(resolvedPath)) {
      return { ok: false, reason: `Firebase service account file not found: ${resolvedPath}` };
    }

    let raw: string;
    try {
      raw = readFileSync(resolvedPath, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: `Could not read Firebase service account file ${resolvedPath}: ${message}`,
      };
    }

    return this.credentialFromJson(raw, `file ${resolvedPath}`);
  }

  private credentialFromJson(rawInput: string, source: string): CredentialResult {
    let parsed: ServiceAccountJson;
    try {
      parsed = JSON.parse(this.decodeJsonInput(rawInput)) as ServiceAccountJson;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: `Invalid Firebase service account JSON (${source}): ${message}` };
    }

    const projectId = (parsed.project_id ?? parsed.projectId)?.trim();
    const clientEmail = (parsed.client_email ?? parsed.clientEmail)?.trim();
    const privateKey = this.normalizePrivateKey(parsed.private_key ?? parsed.privateKey);

    if (!projectId || !clientEmail || !privateKey) {
      return {
        ok: false,
        reason: `Firebase service account JSON (${source}) is missing project_id, client_email or private_key.`,
      };
    }

    if (this.isPlaceholder(projectId) || this.isPlaceholder(clientEmail)) {
      return {
        ok: false,
        reason: `Firebase service account JSON (${source}) still contains placeholder values.`,
      };
    }

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      return {
        ok: false,
        reason: `Firebase service account JSON (${source}) has an invalid private_key (missing "BEGIN PRIVATE KEY").`,
      };
    }

    return {
      ok: true,
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
      source,
    };
  }

  private decodeJsonInput(input: string): string {
    let value = input.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }

    if (value.startsWith('{')) {
      return value;
    }

    // Allow base64-encoded JSON (useful for CI/CD secret stores).
    const decoded = Buffer.from(value, 'base64').toString('utf8').trim();
    return decoded.startsWith('{') ? decoded : value;
  }

  private normalizePrivateKey(input?: string): string | undefined {
    if (!input) {
      return undefined;
    }

    let key = input.trim();

    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1);
    }

    key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').trim();

    if (!key.includes('BEGIN')) {
      const decoded = Buffer.from(key, 'base64').toString('utf8').trim();
      if (decoded.includes('BEGIN')) {
        key = decoded;
      }
    }

    return key;
  }

  private isPlaceholder(value: string): boolean {
    return /your[-_ ]|xxxxx|placeholder|changeme|cambiar|tu[-_]key/i.test(value);
  }

  private toNotificationPayload(notification: Notification): {
    title: string;
    body: string;
    imageUrl?: string;
  } {
    const payload: { title: string; body: string; imageUrl?: string } = {
      title: notification.title,
      body: notification.body,
    };

    // FCM rejects null/undefined imageUrl values, so omit the field entirely.
    if (notification.imageUrl) {
      payload.imageUrl = notification.imageUrl;
    }

    return payload;
  }

  private toDataPayload(data?: Record<string, any>): Record<string, string> {    const payload: Record<string, string> = {};

    if (!data) {
      return payload;
    }

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === 'string') {
        payload[key] = value;
        continue;
      }

      try {
        payload[key] = JSON.stringify(value);
      } catch {
        payload[key] = String(value);
      }
    }

    return payload;
  }

  async send(notification: Notification, deviceTokens: DeviceToken[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.messaging) {
      return {
        success: 0,
        failed: deviceTokens.length,
        errors: [this.statusMessage ?? 'Firebase is not configured'],
      };
    }

    if (deviceTokens.length === 0) {
      return { success: 0, failed: 0, errors: ['No device tokens to send to'] };
    }

    const tokens = deviceTokens.map((dt) => dt.token);
    const messages = tokens.map((token) => ({
      token,
      notification: this.toNotificationPayload(notification),
      data: {
        ...this.toDataPayload(notification.data),
        notificationId: notification.id,
        channel: NotificationChannel.PUSH,
      },
      android: {
        priority: this.mapPriority(notification.priority),
        notification: {
          // Configurable: create this channel in the Android app, or leave unset
          // to let FCM use the app's fallback channel.
          ...(this.androidChannelId ? { channelId: this.androidChannelId } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'content-available': 1,
          },
        },
      },
      webpush: {
        notification: {
          icon: '/assets/icons/notification-icon.png',
          badge: '/assets/icons/badge-icon.png',
        },
      },
    }));

    const results = await Promise.allSettled(
      messages.map((msg) => this.messaging!.send(msg)),
    );

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        success++;
      } else {
        failed++;
        errors.push(`Token ${tokens[index].substring(0, 20)}...: ${result.reason.message}`);
        this.logger.error(`Push failed for token ${tokens[index].substring(0, 20)}...`, result.reason);
      }
    });

    return { success, failed, errors };
  }

  async sendToTopic(notification: Notification, topic: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.messaging) {
      return { success: false, error: this.statusMessage ?? 'Firebase is not configured' };
    }

    try {
      const messageId = await this.messaging.send({
        topic,
        notification: this.toNotificationPayload(notification),
        data: {
          ...this.toDataPayload(notification.data),
          notificationId: notification.id,
          channel: NotificationChannel.PUSH,
        },
      });

      return { success: true, messageId };
    } catch (error) {
      this.logger.error(`Topic push failed for ${topic}`, error);
      return { success: false, error: error.message };
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.messaging || tokens.length === 0) return;

    try {
      await this.messaging.subscribeToTopic(tokens, topic);
      this.logger.log(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}`, error);
      throw error;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.messaging || tokens.length === 0) return;

    try {
      await this.messaging.unsubscribeFromTopic(tokens, topic);
      this.logger.log(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic ${topic}`, error);
      throw error;
    }
  }

  private mapPriority(priority: NotificationPriority): 'high' | 'normal' {
    switch (priority) {
      case NotificationPriority.URGENT:
      case NotificationPriority.HIGH:
        return 'high';
      default:
        return 'normal';
    }
  }
}
