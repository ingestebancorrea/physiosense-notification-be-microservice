import { IsString, IsOptional, IsEnum, IsObject, IsUUID, IsDateString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationChannel, NotificationPriority } from '../../common/enums/notification.enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: 'user-uuid-here' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'Nueva cita agendada' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Tu cita con el Dr. Pérez ha sido confirmada para mañana a las 10:00 AM' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ enum: NotificationChannel, example: NotificationChannel.PUSH })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationPriority, example: NotificationPriority.NORMAL })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ example: { appointmentId: 'apt-123', type: 'confirmation' } })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ example: 'https://example.com/image.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'physiosense://appointments/apt-123' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ example: 'template-uuid-here' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ example: { doctorName: 'Dr. Pérez', time: '10:00 AM' } })
  @IsOptional()
  @IsObject()
  templateData?: Record<string, any>;

  @ApiPropertyOptional({ example: '2024-12-15T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'appointment_confirmation' })
  @IsString()
  name: string;

  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.PUSH })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ example: 'Cita confirmada: {{doctorName}}' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Tu cita con {{doctorName}} está confirmada para {{date}} a las {{time}}.' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ example: ['doctorName', 'date', 'time'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ example: 'Plantilla para confirmación de citas médicas' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class BulkNotificationDto {
  @ApiProperty({ type: [String], example: ['user-1', 'user-2', 'user-3'] })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @ValidateNested()
  @Type(() => CreateNotificationDto)
  notification: Omit<CreateNotificationDto, 'userId'>;
}