import { Controller, Post, Get, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/register-device.dto';
import { DevicePlatform } from '../common/enums/notification.enums';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  @ApiResponse({ status: 201, description: 'Device registered successfully' })
  async register(@Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(dto);
  }

  @Post('unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister a device token' })
  @ApiResponse({ status: 204, description: 'Device unregistered' })
  async unregister(@Query('userId') userId: string, @Body() dto: UnregisterDeviceDto) {
    await this.devicesService.unregister(userId, dto.token);
  }

  @Post('unregister-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister all devices for a user' })
  @ApiResponse({ status: 204, description: 'All devices unregistered' })
  async unregisterAll(@Query('userId') userId: string) {
    await this.devicesService.unregisterAll(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get user devices' })
  @ApiResponse({ status: 200, description: 'List of user devices' })
  async getUserDevices(@Query('userId') userId: string) {
    return this.devicesService.getUserDevices(userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get device statistics' })
  @ApiResponse({ status: 200, description: 'Device counts by platform' })
  async getStats() {
    return this.devicesService.getDeviceCountsByPlatform();
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Clean up inactive device tokens' })
  @ApiResponse({ status: 200, description: 'Number of cleaned up tokens' })
  async cleanup(@Query('days') days?: number) {
    const cleaned = await this.devicesService.cleanupInactive(days || 90);
    return { cleaned, message: `Cleaned up ${cleaned} inactive device tokens` };
  }
}