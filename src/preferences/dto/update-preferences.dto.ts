import { IsArray, ValidateNested, IsEnum, IsBoolean, IsOptional, IsString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '../common/enums/notification.enums';

export class PreferenceItemDto {
  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.PUSH })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({ example: 'appointments' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ example: { frequency: 'immediate' } })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: [PreferenceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  preferences: PreferenceItemDto[];
}