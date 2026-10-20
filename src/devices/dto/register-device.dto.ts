import { IsString, IsEnum, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '../../common/enums/notification.enums';

export class RegisterDeviceDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'fcm-token-string-here' })
  @IsString()
  token: string;

  @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.ANDROID })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiPropertyOptional({ example: '1.2.3' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({ example: 'iPhone 15 Pro' })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiPropertyOptional({ example: 'iOS 17.2' })
  @IsOptional()
  @IsString()
  osVersion?: string;
}

export class UnregisterDeviceDto {
  @ApiProperty({ example: 'fcm-token-string-here' })
  @IsString()
  token: string;
}