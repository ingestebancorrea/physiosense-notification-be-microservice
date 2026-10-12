import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationChannel, NotificationStatus } from '../common/enums/notification.enums';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get('SMTP_HOST');
    const port = this.configService.get('SMTP_PORT');
    const user = this.configService.get('SMTP_USER');
    const pass = this.configService.get('SMTP_PASS');
    const from = this.configService.get('SMTP_FROM') || 'noreply@physiosense.com';

    if (!host || !port || !user || !pass) {
      this.logger.warn('SMTP credentials not configured. Email notifications will not work.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === '465',
      auth: { user, pass },
      from,
    });

    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('SMTP connection failed', error);
      } else {
        this.logger.log('SMTP server ready');
      }
    });
  }

  async send(notification: Notification, email: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      const html = this.buildHtmlTemplate(notification);
      const text = this.buildTextTemplate(notification);

      const info = await this.transporter.sendMail({
        to: email,
        subject: notification.title,
        html,
        text,
      });

      this.logger.log(`Email sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Email failed for ${email}`, error);
      return { success: false, error: error.message };
    }
  }

  async sendBulk(notification: Notification, emails: string[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.transporter || emails.length === 0) {
      return { success: 0, failed: emails.length, errors: ['SMTP not configured or no emails'] };
    }

    const results = await Promise.allSettled(
      emails.map((email) => this.send(notification, email)),
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
        errors.push(`${emails[index]}: ${error}`);
      }
    });

    return { success, failed, errors };
  }

  private buildHtmlTemplate(notification: Notification): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">${notification.title}</h1>
  </div>
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
    <p style="font-size: 16px; margin: 0 0 16px;">${notification.body}</p>
    ${notification.actionUrl ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${notification.actionUrl}" style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Ver en la app
        </a>
      </div>
    ` : ''}
    ${notification.imageUrl ? `
      <div style="text-align: center; margin: 16px 0;">
        <img src="${notification.imageUrl}" alt="" style="max-width: 100%; height: auto; border-radius: 8px;">
      </div>
    ` : ''}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
      Este correo fue enviado por PhysioSense. Si no deseas recibir estas notificaciones, puedes cambiar tus preferencias en la app.
    </p>
  </div>
</body>
</html>`;
  }

  private buildTextTemplate(notification: Notification): string {
    return `
${notification.title}

${notification.body}

${notification.actionUrl ? `Ver en la app: ${notification.actionUrl}` : ''}

---
Este correo fue enviado por PhysioSense.
    `.trim();
  }
}