/**
 * Solutions Module
 *
 * Provides SolutionLoaderService for body-based solution import.
 * No auto-discovery at startup — solutions are imported via POST /import.
 */

import { Module } from '@nestjs/common';
import { SolutionLoaderService } from './solution-loader.service';
import { SkillsModule } from '../skills/skills.module';
import { SessionsModule } from '../sessions/sessions.module';
import { BundleModule } from '../bundles/bundle.module';

@Module({
  imports: [
    // SkillsModule provides SkillsService (not @Global, requires explicit import)
    // SolutionsModule and McpModule are @Global — auto-available
    SkillsModule,
    // SessionsModule provides EventMapperService for tool event trigger registration
    SessionsModule,
    // BundleModule provides BundleService for resolving bundle triggers
    BundleModule,
  ],
  providers: [SolutionLoaderService],
  exports: [SolutionLoaderService],
})
export class SolutionLoaderModule {}
