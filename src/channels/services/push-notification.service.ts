import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Notification } from '../../notifications/entities/notification.entity';
import { DeviceToken } from '../../devices/entities/device-token.entity';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
} from '../../common/enums/notification.enums';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private messaging: admin.messaging.Messaging;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const projectId = this.configService.get('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured. Push notifications will not work.');
      return;
    }

    if (privateKey.includes('YOUR_PRIVATE_KEY') || clientEmail.includes('your-project')) {
      this.logger.warn('Firebase credentials are placeholders. Push notifications will not work.');
      return;
    }

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }

      this.messaging = admin.messaging();
    } catch (error) {
      this.logger.error(`Failed to initialize Firebase: ${error.message}. Push notifications will not work.`);
    }
  }

  async send(notification: Notification, deviceTokens: DeviceToken[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.messaging || deviceTokens.length === 0) {
      return { success: 0, failed: deviceTokens.length, errors: ['Firebase not configured or no device tokens'] };
    }

    const tokens = deviceTokens.map((dt) => dt.token);
    const messages = tokens.map((token) => ({
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...notification.data,
        notificationId: String(notification.id),
        channel: NotificationChannel.PUSH,
      },
      android: {
        priority: this.mapPriority(notification.priority),
        notification: {
          channelId: 'physiosense_default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
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
      messages.map((msg) => this.messaging.send(msg)),
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
      return { success: false, error: 'Firebase not configured' };
    }

    try {
      const messageId = await this.messaging.send({
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...notification.data,
          notificationId: String(notification.id),
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