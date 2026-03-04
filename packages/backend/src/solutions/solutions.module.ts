/**
 * Solutions Module
 *
 * Wires together the auto-discovery pipeline:
 *   SolutionScannerService  - Scans solutions/ for valid configs
 *   SkillMetadataParserService - Parses SKILL.md frontmatter
 *   SolutionLoaderService   - Orchestrates tenant/skill/MCP registration
 *   SolutionConfigAdapter   - Migrates v1 configs to v2
 *
 * Auto-discovery runs at startup via OnApplicationBootstrap.
 * Solutions with discovery.enabled = false are skipped.
 *
 * External dependencies (TenantsService, SkillsService, McpPoolService)
 * are resolved via their respective modules:
 *   - TenantsModule (@Global) - auto-available
 *   - McpModule (@Global) - auto-available
 *   - SkillsModule - imported explicitly
 */

import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { SolutionScannerService } from './solution-scanner.service';
import { SkillMetadataParserService } from './skill-metadata-parser.service';
import { SolutionLoaderService } from './solution-loader.service';
import { SolutionConfigAdapter } from './solution-config-adapter';
import { SkillsModule } from '../skills/skills.module';
import { SessionsModule } from '../sessions/sessions.module';
import { BundleModule } from '../bundles/bundle.module';

@Module({
  imports: [
    // SkillsModule provides SkillsService (not @Global, requires explicit import)
    // TenantsModule and McpModule are @Global — auto-available
    SkillsModule,
    // SessionsModule provides EventMapperService for tool event trigger registration
    SessionsModule,
    // BundleModule provides BundleService for resolving bundle triggers
    BundleModule,
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
export class SolutionsModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(SolutionsModule.name);

  constructor(private readonly solutionLoaderService: SolutionLoaderService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.AUTO_DISCOVERY === 'false') {
      this.logger.log('Auto-discovery disabled (AUTO_DISCOVERY=false)');
      return;
    }

    try {
      const result = await this.solutionLoaderService.loadAll();
      this.logger.log(
        `Auto-discovery: ${result.loaded.length} solutions loaded, ` +
        `${result.totalSkills} skills, ${result.totalMcpServers} MCP servers` +
        (result.failed.length > 0 ? `, ${result.failed.length} failed` : ''),
      );
    } catch (error) {
      this.logger.warn(`Auto-discovery failed: ${(error as Error).message}`);
    }
  }
}
