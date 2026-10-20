import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Notification } from '../../notifications/entities/notification.entity';
import { DeviceToken } from '../../devices/entities/device-token.entity';
import { NotificationPreference } from '../../preferences/entities/notification-preference.entity';
import { PushNotificationService } from './push-notification.service';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
} from '../../common/enums/notification.enums';

interface SendNotificationOptions {
  userId: string;
  title: string;
  body: string;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  scheduledAt?: Date;
}

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
    @InjectRepository(NotificationPreference)
    private preferenceRepository: Repository<NotificationPreference>,
    private pushService: PushNotificationService,
    private configService: ConfigService,
  ) {}

  async send(options: SendNotificationOptions): Promise<Notification[]> {
    const { userId, channel, ...rest } = options;
    const channels = channel ? [channel] : await this.getEnabledChannels(userId);

    const notifications = await Promise.all(
      channels.map((ch) => this.createNotification({ ...rest, userId, channel: ch })),
    );

    await this.dispatchAll(notifications);

    return notifications;
  }

  async sendBulk(
    userIds: string[],
    options: Omit<SendNotificationOptions, 'userId'>,
  ): Promise<Map<string, Notification[]>> {
    const results = new Map<string, Notification[]>();

    await Promise.all(
      userIds.map(async (userId) => {
        const notifications = await this.send({ ...options, userId });
        results.set(userId, notifications);
      }),
    );

    return results;
  }

  async sendToTopic(
    topic: string,
    options: Omit<SendNotificationOptions, 'userId' | 'channel'>,
  ): Promise<void> {
    const notification = this.notificationRepository.create({
      ...options,
      channel: NotificationChannel.PUSH,
      userId: `topic:${topic}`,
      status: NotificationStatus.PENDING,
    });

    await this.notificationRepository.save(notification);
    await this.pushService.sendToTopic(notification, topic);
  }

  private async getEnabledChannels(userId: string): Promise<NotificationChannel[]> {
    const preferences = await this.preferenceRepository.find({ where: { userId } });

    const defaultChannels: NotificationChannel[] = [NotificationChannel.PUSH];

    if (preferences.length === 0) {
      return defaultChannels;
    }

    return preferences
      .filter((p) => p.enabled && p.channel === NotificationChannel.PUSH)
      .map((p) => p.channel);
  }

  private async createNotification(data: Omit<SendNotificationOptions, 'channel'> & { channel: NotificationChannel }): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...data,
      status: NotificationStatus.PENDING,
      retryCount: 0,
    });

    return this.notificationRepository.save(notification);
  }

  private async dispatchAll(notifications: Notification[]): Promise<void> {
    for (const notification of notifications) {
      try {
        await this.dispatch(notification);
      } catch (error) {
        this.logger.error(`Failed to dispatch notification ${notification.id}`, error);
        await this.handleFailure(notification, error.message);
      }
    }
  }

  private async dispatch(notification: Notification): Promise<void> {
    switch (notification.channel) {
      case NotificationChannel.PUSH:
        await this.dispatchPush(notification);
        break;
      default:
        await this.handleFailure(notification, `Unsupported channel: ${notification.channel}`);
    }
  }

  private async dispatchPush(notification: Notification): Promise<void> {
    const deviceTokens = await this.deviceTokenRepository.find({
      where: { userId: notification.userId, isActive: true },
    });

    if (deviceTokens.length === 0) {
      await this.handleFailure(notification, 'No active device tokens');
      return;
    }

    const result = await this.pushService.send(notification, deviceTokens);

    if (result.success > 0) {
      await this.markSent(notification);
    } else {
      await this.handleFailure(notification, result.errors.join('; '));
    }
  }

  private async markSent(notification: Notification): Promise<void> {
    await this.notificationRepository.update(notification.id, {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      errorMessage: null,
    });
  }

  private async handleFailure(notification: Notification, error: string): Promise<void> {
    const maxRetries = this.configService.get('MAX_NOTIFICATION_RETRIES') || 3;
    const newRetryCount = notification.retryCount + 1;

    if (newRetryCount >= maxRetries) {
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
        errorMessage: error,
        retryCount: newRetryCount,
      });
      this.logger.error(`Notification ${notification.id} failed permanently: ${error}`);
    } else {
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.PENDING,
        errorMessage: error,
        retryCount: newRetryCount,
        scheduledAt: new Date(Date.now() + newRetryCount * 60000),
      });
      this.logger.warn(`Notification ${notification.id} failed (attempt ${newRetryCount}): ${error}`);
    }
  }

  async retryFailed(limit = 100): Promise<number> {
    const failed = await this.notificationRepository.find({
      where: { status: NotificationStatus.FAILED },
      take: limit,
    });

    let retried = 0;
    for (const notification of failed) {
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.PENDING,
        retryCount: 0,
        errorMessage: null,
      });
      await this.dispatch(notification);
      retried++;
    }

    return retried;
  }
}