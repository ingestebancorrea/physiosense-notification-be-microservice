import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationDispatcherService } from '../channels/services/notification-dispatcher.service';
import { NotificationChannel, NotificationStatus, NotificationPriority } from '../common/enums/notification.enums';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
    private dispatcher: NotificationDispatcherService,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification[]> {
    const priority = dto.priority || NotificationPriority.NORMAL;

    if (dto.templateId) {
      const template = await this.templateRepository.findOne({
        where: { id: dto.templateId, isActive: true },
      });

      if (template) {
        return this.dispatcher.send({
          userId: dto.userId,
          title: this.renderTemplate(template.title, dto.templateData || {}),
          body: this.renderTemplate(template.body, dto.templateData || {}),
          channel: dto.channel || template.channel as NotificationChannel,
          priority,
          data: dto.data,
          imageUrl: dto.imageUrl,
          actionUrl: dto.actionUrl,
          templateId: template.id,
          templateData: dto.templateData,
          scheduledAt: dto.scheduledAt,
        });
      }
    }

    return this.dispatcher.send({
      userId: dto.userId,
      title: dto.title,
      body: dto.body,
      channel: dto.channel,
      priority,
      data: dto.data,
      imageUrl: dto.imageUrl,
      actionUrl: dto.actionUrl,
      scheduledAt: dto.scheduledAt,
    });
  }

  async createBulk(userIds: string[], dto: Omit<CreateNotificationDto, 'userId'>): Promise<Map<string, Notification[]>> {
    return this.dispatcher.sendBulk(userIds, dto);
  }

  async sendToTopic(topic: string, dto: Omit<CreateNotificationDto, 'userId' | 'channel'>): Promise<void> {
    return this.dispatcher.sendToTopic(topic, dto);
  }

  async findByUser(
    userId: string,
    options: {
      channel?: NotificationChannel;
      status?: NotificationStatus;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{ data: Notification[]; total: number }> {
    const { channel, status, limit = 50, offset = 0, startDate, endDate } = options;

    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (channel) {
      query.andWhere('notification.channel = :channel', { channel });
    }

    if (status) {
      query.andWhere('notification.status = :status', { status });
    }

    if (startDate && endDate) {
      query.andWhere('notification.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string, userId: string): Promise<Notification | null> {
    return this.notificationRepository.findOne({
      where: { id, userId },
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, userId },
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

  async getStats(userId: string): Promise<{
    total: number;
    unread: number;
    byChannel: Record<NotificationChannel, number>;
    byStatus: Record<NotificationStatus, number>;
  }> {
    const notifications = await this.notificationRepository.find({ where: { userId } });

    const byChannel = Object.values(NotificationChannel).reduce((acc, ch) => {
      acc[ch] = notifications.filter((n) => n.channel === ch).length;
      return acc;
    }, {} as Record<NotificationChannel, number>);

    const byStatus = Object.values(NotificationStatus).reduce((acc, st) => {
      acc[st] = notifications.filter((n) => n.status === st).length;
      return acc;
    }, {} as Record<NotificationStatus, number>);

    return {
      total: notifications.length,
      unread: notifications.filter((n) => n.status === NotificationStatus.SENT).length,
      byChannel,
      byStatus,
    };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.notificationRepository.delete({ id, userId });
    return (result.affected || 0) > 0;
  }

  async createTemplate(dto: CreateTemplateDto): Promise<NotificationTemplate> {
    const template = this.templateRepository.create(dto);
    return this.templateRepository.save(template);
  }

  async getTemplates(channel?: NotificationChannel): Promise<NotificationTemplate[]> {
    const query = this.templateRepository
      .createQueryBuilder('template')
      .where('template.isActive = :isActive', { isActive: true });

    if (channel) {
      query.andWhere('template.channel = :channel', { channel });
    }

    return query.orderBy('template.name', 'ASC').getMany();
  }

  async updateTemplate(id: string, dto: Partial<CreateTemplateDto>): Promise<NotificationTemplate | null> {
    await this.templateRepository.update(id, dto);
    return this.templateRepository.findOne({ where: { id } });
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await this.templateRepository.delete(id);
    return (result.affected || 0) > 0;
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }
}