import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationsModule } from './notifications/notifications.module';
import { DevicesModule } from './devices/devices.module';
import { PreferencesModule } from './preferences/preferences.module';
import { ChannelsModule } from './channels/channels.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        schema: configService.get('DB_SCHEMA') || 'public',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        // Las consultas SQL solo se imprimen si se habilita DB_LOGGING=true.
        // NODE_ENV=development ya no activa el log por sí solo para no llenar
        // la consola en el entorno local.
        logging: configService.get('DB_LOGGING') === 'true',
        ssl: configService.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    NotificationsModule,
    DevicesModule,
    PreferencesModule,
    ChannelsModule,
  ],
})
export class AppModule {}