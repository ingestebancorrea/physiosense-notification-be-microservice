import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationChannel, NotificationStatus } from '../common/enums/notification.enums';

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async create(notification: Notification): Promise<Notification> {
    notification.channel = NotificationChannel.IN_APP;
    notification.status = NotificationStatus.SENT;
    notification.sentAt = new Date();

    const saved = await this.notificationRepository.save(notification);
    this.logger.log(`In-app notification created: ${saved.id} for user ${saved.userId}`);
    return saved;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { status: NotificationStatus.READ, readAt: new Date() },
    );
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepository.update(
      { userId, status: NotificationStatus.SENT },
      { status: NotificationStatus.READ, readAt: new Date() },
    );
    return result.affected || 0;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
      },
    });
  }

  async findByUser(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ): Promise<Notification[]> {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.channel = :channel', { channel: NotificationChannel.IN_APP })
      .orderBy('notification.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (unreadOnly) {
      query.andWhere('notification.status = :status', { status: NotificationStatus.SENT });
    }

    return query.getMany();
  }

  async delete(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.notificationRepository.delete({ id: notificationId, userId });
    return (result.affected || 0) > 0;
  }

  async deleteAllRead(userId: string): Promise<number> {
    const result = await this.notificationRepository.delete({
      userId,
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.READ,
    });
    return result.affected || 0;
  }
}