import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { CharityModule } from './charity/charity.module';
import { AdminModule } from './admin/admin.module';
import { S3Module } from './s3/s3.module';
import { TonApiCoreModule } from './tonapi/tonapi.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TonApiCoreModule.forRootAsync(),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    CharityModule,
    AdminModule,
    S3Module
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
