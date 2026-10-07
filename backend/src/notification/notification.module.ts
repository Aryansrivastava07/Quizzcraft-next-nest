import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationProviders } from './notification.provider';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [NotificationController],
  providers: [...NotificationProviders, NotificationService],
  exports: [NotificationService, ...NotificationProviders],
})
export class NotificationModule {}
