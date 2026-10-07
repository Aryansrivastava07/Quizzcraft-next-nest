import { Module } from '@nestjs/common';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { GroupProviders } from './group.provider';
import { CohortWsGateway } from './cohort.gateway';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [GroupController],
  providers: [...GroupProviders, CohortWsGateway, GroupService],
  exports: [GroupService, CohortWsGateway, ...GroupProviders],
})
export class GroupModule {}
