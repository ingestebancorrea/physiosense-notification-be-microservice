import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationChannel } from '../common/enums/notification.enums';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private preferenceRepository: Repository<NotificationPreference>,
  ) {}

  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({
      where: { userId },
      order: { channel: 'ASC', category: 'ASC' },
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<NotificationPreference[]> {
    const { preferences } = dto;

    for (const pref of preferences) {
      await this.preferenceRepository.upsert(
        {
          userId,
          channel: pref.channel,
          category: pref.category || null,
          enabled: pref.enabled,
          settings: pref.settings || {},
        },
        ['userId', 'channel', 'category'],
      );
    }

    return this.getUserPreferences(userId);
  }

  async updateSingle(
    userId: string,
    channel: NotificationChannel,
    category: string | null,
    enabled: boolean,
    settings?: Record<string, any>,
  ): Promise<NotificationPreference> {
    const preference = await this.preferenceRepository.upsert(
      {
        userId,
        channel,
        category,
        enabled,
        settings: settings || {},
      },
      ['userId', 'channel', 'category'],
    );

    return this.preferenceRepository.findOneOrFail({
      where: { userId, channel, category: category || null },
    });
  }

  async getEffectivePreferences(userId: string): Promise<Record<NotificationChannel, boolean>> {
    const prefs = await this.getUserPreferences(userId);

    const defaults: Record<NotificationChannel, boolean> = {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.PUSH]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    };

    const result = { ...defaults };

    prefs.forEach((pref) => {
      if (!pref.category) {
        result[pref.channel] = pref.enabled;
      }
    });

    return result;
  }

  async isEnabled(userId: string, channel: NotificationChannel, category?: string): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);

    const specific = prefs.find((p) => p.channel === channel && p.category === category);
    if (specific) return specific.enabled;

    const general = prefs.find((p) => p.channel === channel && !p.category);
    if (general) return general.enabled;

    const defaults: Record<NotificationChannel, boolean> = {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.PUSH]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    };

    return defaults[channel];
  }

  async resetToDefaults(userId: string): Promise<void> {
    await this.preferenceRepository.delete({ userId });
  }
}