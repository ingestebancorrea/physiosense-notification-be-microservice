import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { DeviceToken } from '../devices/entities/device-token.entity';
import { NotificationPreference } from '../preferences/entities/notification-preference.entity';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, DeviceToken, NotificationPreference])],
  providers: [PushNotificationService, NotificationDispatcherService],
  exports: [PushNotificationService, NotificationDispatcherService],
})
export class ChannelsModule {}