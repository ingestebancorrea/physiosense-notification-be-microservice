import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [PushNotificationService, NotificationDispatcherService],
  exports: [PushNotificationService, NotificationDispatcherService],
})
export class ChannelsModule {}