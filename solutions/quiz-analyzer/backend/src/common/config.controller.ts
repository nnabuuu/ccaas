import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller('config')
export class ConfigController {
  private solutionConfig: Record<string, unknown> | null = null;

  constructor() {
    try {
      // solution.json is 2 levels up from dist/common/
      const configPath = join(__dirname, '..', '..', '..', 'solution.json');
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
