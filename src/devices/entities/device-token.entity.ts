import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { DevicePlatform } from '../common/enums/notification.enums';

@Entity('device_tokens')
@Unique(['userId', 'token'])
@Index(['userId', 'isActive'])
@Index(['token'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  token: string;

  @Column({
    type: 'enum',
    enum: DevicePlatform,
  })
  platform: DevicePlatform;

  @Column({ type: 'varchar', length: 255, nullable: true })
  appVersion: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceModel: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  osVersion: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}