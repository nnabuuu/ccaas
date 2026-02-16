/**
 * Solutions Module
 *
 * Wires together the auto-discovery pipeline:
 *   SolutionScannerService  - Scans solutions/ for valid configs
 *   SkillMetadataParserService - Parses SKILL.md frontmatter
 *   SolutionLoaderService   - Orchestrates tenant/skill/MCP registration
 *   SolutionConfigAdapter   - Migrates v1 configs to v2
 *
 * Auto-discovery is triggered from main.ts after app.listen().
 *
 * External dependencies (TenantsService, SkillsService, McpPoolService)
 * are resolved via their respective modules:
 *   - TenantsModule (@Global) - auto-available
 *   - McpModule (@Global) - auto-available
 *   - SkillsModule - imported explicitly
 */

import { Module } from '@nestjs/common';
import { SolutionScannerService } from './solution-scanner.service';
import { SkillMetadataParserService } from './skill-metadata-parser.service';
import { SolutionLoaderService } from './solution-loader.service';
import { SolutionConfigAdapter } from './solution-config-adapter';
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [
    // SkillsModule provides SkillsService (not @Global, requires explicit import)
    // TenantsModule and McpModule are @Global — auto-available
    SkillsModule,
  ],
  providers: [
    SolutionScannerService,
    SkillMetadataParserService,
    SolutionLoaderService,
    SolutionConfigAdapter,
  ],
  exports: [
    SolutionScannerService,
    SkillMetadataParserService,
    SolutionLoaderService,
    SolutionConfigAdapter,
  ],
})
export class SolutionsModule {}
