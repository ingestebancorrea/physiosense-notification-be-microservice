import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, CreateTemplateDto, BulkNotificationDto } from './dto/create-notification.dto';
import { NotificationChannel, NotificationStatus } from '../common/enums/notification.enums';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and send a notification' })
  @ApiResponse({ status: 201, description: 'Notification created and dispatched' })
  async create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Send notification to multiple users' })
  @ApiResponse({ status: 201, description: 'Notifications sent to all users' })
  async createBulk(@Body() dto: BulkNotificationDto) {
    return this.notificationsService.createBulk(dto.userIds, dto.notification);
  }

  @Post('topic/:topic')
  @ApiOperation({ summary: 'Send notification to a topic (FCM)' })
  @ApiResponse({ status: 201, description: 'Notification sent to topic subscribers' })
  async sendToTopic(
    @Param('topic') topic: string,
    @Body() dto: Omit<CreateNotificationDto, 'userId' | 'channel'>,
  ) {
    await this.notificationsService.sendToTopic(topic, dto);
    return { message: `Notification sent to topic: ${topic}` };
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications with filters' })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  async findByUser(
    @Query('userId') userId: string,
    @Query('channel') channel?: NotificationChannel,
    @Query('status') status?: NotificationStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.notificationsService.findByUser(userId, {
      channel,
      status,
      limit,
      offset,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics for user' })
  @ApiResponse({ status: 200, description: 'Notification statistics' })
  async getStats(@Query('userId') userId: string) {
    return this.notificationsService.getStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  async findOne(@Param('id') id: string, @Query('userId') userId: string) {
    return this.notificationsService.findOne(id, userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 204, description: 'Notification marked as read' })
  async markAsRead(@Param('id') id: string, @Query('userId') userId: string) {
    await this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 204, description: 'All notifications marked as read' })
  async markAllAsRead(@Query('userId') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 204, description: 'Notification deleted' })
  async delete(@Param('id') id: string, @Query('userId') userId: string) {
    await this.notificationsService.delete(id, userId);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create notification template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return this.notificationsService.createTemplate(dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all templates' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async getTemplates(@Query('channel') channel?: NotificationChannel) {
    return this.notificationsService.getTemplates(channel);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  async updateTemplate(@Param('id') id: string, @Body() dto: Partial<CreateTemplateDto>) {
    return this.notificationsService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete template' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  async deleteTemplate(@Param('id') id: string) {
    await this.notificationsService.deleteTemplate(id);
  }
}