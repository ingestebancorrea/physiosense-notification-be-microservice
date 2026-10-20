import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { DevicePlatform } from '../common/enums/notification.enums';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  async register(dto: RegisterDeviceDto): Promise<DeviceToken> {
    const existing = await this.deviceTokenRepository.findOne({
      where: { userId: dto.userId, token: dto.token },
    });

    if (existing) {
      existing.platform = dto.platform;
      existing.appVersion = dto.appVersion ?? existing.appVersion;
      existing.deviceModel = dto.deviceModel ?? existing.deviceModel;
      existing.osVersion = dto.osVersion ?? existing.osVersion;
      existing.isActive = true;
      existing.lastUsedAt = new Date();
      return this.deviceTokenRepository.save(existing);
    }

    const deviceToken = this.deviceTokenRepository.create({
      ...dto,
      isActive: true,
      lastUsedAt: new Date(),
    });

    return this.deviceTokenRepository.save(deviceToken);
  }

  async unregister(userId: number, token: string): Promise<boolean> {
    const result = await this.deviceTokenRepository.update(
      { userId, token },
      { isActive: false },
    );
    return (result.affected || 0) > 0;
  }

  async unregisterAll(userId: number): Promise<number> {
    const result = await this.deviceTokenRepository.update(
      { userId },
      { isActive: false },
    );
    return result.affected || 0;
  }

  async getUserDevices(userId: number): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { userId, isActive: true },
      order: { lastUsedAt: 'DESC' },
    });
  }

  async getAllDevices(): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { isActive: true },
      order: { lastUsedAt: 'DESC' },
    });
  }

  async updateLastUsed(userId: number, token: string): Promise<void> {
    await this.deviceTokenRepository.update(
      { userId, token },
      { lastUsedAt: new Date() },
    );
  }

  async cleanupInactive(days = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.deviceTokenRepository
      .createQueryBuilder()
      .delete()
      .where('isActive = :isActive', { isActive: true })
      .andWhere('lastUsedAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  async getDeviceCountsByPlatform(): Promise<Record<DevicePlatform, number>> {
    const devices = await this.deviceTokenRepository.find({
      where: { isActive: true },
      select: ['platform'],
    });

    const counts = Object.values(DevicePlatform).reduce((acc, platform) => {
      acc[platform] = 0;
      return acc;
    }, {} as Record<DevicePlatform, number>);

    devices.forEach((d) => {
      counts[d.platform]++;
    });

    return counts;
  }
}