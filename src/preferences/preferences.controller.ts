import { Controller, Get, Put, Patch, Delete, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationChannel } from '../common/enums/notification.enums';

@ApiTags('preferences')
@ApiBearerAuth()
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, description: 'List of preferences' })
  async getPreferences(@Query('userId') userId: number) {
    return this.preferencesService.getUserPreferences(userId);
  }

  @Get('effective')
  @ApiOperation({ summary: 'Get effective preferences (with defaults)' })
  @ApiResponse({ status: 200, description: 'Effective preferences per channel' })
  async getEffectivePreferences(@Query('userId') userId: number) {
    return this.preferencesService.getEffectivePreferences(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update user notification preferences (bulk)' })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  async updatePreferences(@Query('userId') userId: number, @Body() dto: UpdatePreferencesDto) {
    return this.preferencesService.updatePreferences(userId, dto);
  }

  @Patch(':channel')
  @ApiOperation({ summary: 'Update single preference' })
  @ApiResponse({ status: 200, description: 'Updated preference' })
  async updateSingle(
    @Query('userId') userId: number,
    @Param('channel') channel: NotificationChannel,
    @Query('category') category: string | null,
    @Body() body: { enabled: boolean; settings?: Record<string, any> },
  ) {
    return this.preferencesService.updateSingle(userId, channel, category, body.enabled, body.settings);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset preferences to defaults' })
  @ApiResponse({ status: 204, description: 'Preferences reset' })
  async resetPreferences(@Query('userId') userId: number) {
    await this.preferencesService.resetToDefaults(userId);
  }
}