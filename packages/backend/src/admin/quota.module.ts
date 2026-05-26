/**
 * Quota Module
 *
 * Global module providing tenant quota management.
 * Separated from AdminModule to avoid circular dependencies,
 * since both SessionsModule and MessagesModule need QuotaService.
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolutionQuota } from './entities/solution-quota.entity';
import { QuotaService } from './quota.service';
import { QuotaGuard } from './guards/quota.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SolutionQuota])],
  providers: [QuotaService, QuotaGuard],
  exports: [QuotaService, QuotaGuard],
})
export class QuotaModule {}
