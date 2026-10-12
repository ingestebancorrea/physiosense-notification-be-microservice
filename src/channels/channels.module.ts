import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { PushNotificationService } from './services/push-notification.service';
import { EmailNotificationService } from './services/email-notification.service';
import { SmsNotificationService } from './services/sms-notification.service';
import { InAppNotificationService } from './services/in-app-notification.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [
    PushNotificationService,
    EmailNotificationService,
    SmsNotificationService,
    InAppNotificationService,
    NotificationDispatcherService,
  ],
  exports: [
    PushNotificationService,
    EmailNotificationService,
    SmsNotificationService,
    InAppNotificationService,
    NotificationDispatcherService,
  ],
})
export class ChannelsModule {}