import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationProviders } from './organization.provider';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [OrganizationController],
  providers: [...OrganizationProviders, OrganizationService],
  exports: [OrganizationService, ...OrganizationProviders],
})
export class OrganizationModule {}
