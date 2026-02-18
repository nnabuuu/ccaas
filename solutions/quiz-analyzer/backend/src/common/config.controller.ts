import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller('config')
export class ConfigController {
  private solutionConfig: Record<string, unknown> | null = null;

  constructor() {
    try {
      // SOLUTION_CONFIG_PATH env var overrides the default path (useful if build structure changes)
      const configPath = process.env.SOLUTION_CONFIG_PATH || join(__dirname, '..', '..', '..', 'solution.json');
      this.solutionConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      console.warn('Could not load solution.json for config endpoint');
    }
  }

  /**
   * GET /api/config
   * Returns solution configuration including sessionTemplates for the frontend SDK.
   */
  @Get()
  getConfig() {
    if (!this.solutionConfig) {
      return { mcpServers: {}, sessionTemplates: {} };
    }

    return {
      mcpServers: this.solutionConfig['mcpServers'] || {},
      sessionTemplates: this.solutionConfig['sessionTemplates'] || {},
    };
  }
}
