import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationChannel, NotificationStatus } from '../common/enums/notification.enums';

interface SmsOptions {
  to: string;
  body: string;
}

@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);
  private client: any;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn('Twilio credentials not configured. SMS notifications will not work.');
      return;
    }

    try {
      const twilio = require('twilio');
      this.client = twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Twilio client', error);
    }
  }

  async send(notification: Notification, phoneNumber: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const message = await this.client.messages.create({
        body: this.buildSmsBody(notification),
        from: this.configService.get('TWILIO_FROM_NUMBER'),
        to: phoneNumber,
      });

      this.logger.log(`SMS sent to ${phoneNumber}: ${message.sid}`);
      return { success: true, messageId: message.sid };
    } catch (error) {
      this.logger.error(`SMS failed for ${phoneNumber}`, error);
      return { success: false, error: error.message };
    }
  }

  async sendBulk(notification: Notification, phoneNumbers: string[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.client || phoneNumbers.length === 0) {
      return { success: 0, failed: phoneNumbers.length, errors: ['Twilio not configured or no phone numbers'] };
    }

    const results = await Promise.allSettled(
      phoneNumbers.map((phone) => this.send(notification, phone)),
    );

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
      } else {
        failed++;
        const error = result.status === 'rejected' ? result.reason.message : result.value.error;
        errors.push(`${phoneNumbers[index]}: ${error}`);
      }
    });

    return { success, failed, errors };
  }

  private buildSmsBody(notification: Notification): string {
    const maxLength = 160;
    let body = `${notification.title}\n\n${notification.body}`;

    if (notification.actionUrl) {
      body += `\n\n${notification.actionUrl}`;
    }

    if (body.length > maxLength) {
      body = body.substring(0, maxLength - 3) + '...';
    }

    return body;
  }
}