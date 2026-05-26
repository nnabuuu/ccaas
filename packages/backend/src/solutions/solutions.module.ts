/**
 * Solutions Module
 *
 * Handles multi-tenancy with guards and services.
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolutionsController } from './solutions.controller';
import { SolutionsService } from './solutions.service';
import { SolutionAuthGuard } from './solution-auth.guard';
import { Solution } from './entities/solution.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Solution]),
  ],
  controllers: [SolutionsController],
  providers: [SolutionsService, SolutionAuthGuard],
  exports: [SolutionsService, SolutionAuthGuard],
})
export class SolutionsModule {}
