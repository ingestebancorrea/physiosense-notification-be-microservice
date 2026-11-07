import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FirebaseStatus, PushNotificationService } from './services/push-notification.service';

@ApiTags('push')
@Controller('push')
export class PushStatusController {
  constructor(private readonly pushService: PushNotificationService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Check Firebase Cloud Messaging configuration',
    description:
      'Returns whether Firebase Admin SDK was initialized successfully. Never exposes credentials.',
  })
  @ApiResponse({ status: 200, description: 'Firebase configuration status' })
  getStatus(): FirebaseStatus {
    return this.pushService.getStatus();
  }
}
