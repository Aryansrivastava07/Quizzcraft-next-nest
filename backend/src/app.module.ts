import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { MailModule } from './mail/mail.module';
import { ProfileModule } from './profile/profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { QuizModule } from './quiz/quiz.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';

import { OrganizationModule } from './organization/organization.module';
import { GroupModule } from './group/group.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    AuthModule,
    DbModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    MailModule,
    ProfileModule,
    RedisModule,
    QuizModule,
    AiModule,
    HealthModule,
    OrganizationModule,
    GroupModule,
    NotificationModule,
  ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
