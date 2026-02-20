import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

interface SolutionConfig {
  name: string;
  slug: string;
  mcpServers: Record<string, {
    command: string;
    args: string[];
    description?: string;
  }>;
  skill: {
    name: string;
    skillFile: string;
  };
}

@Controller('config')
export class SolutionConfigController {
  private solutionConfig: SolutionConfig | null = null;
  private solutionDir: string;

  constructor(private readonly configService: ConfigService) {
    // Get solution directory (3 levels up from dist/config/config.controller.js)
    this.solutionDir = join(__dirname, '..', '..', '..');
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const configPath = join(this.solutionDir, 'solution.json');
      this.solutionConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

      // Resolve relative paths in MCP server args
      if (this.solutionConfig?.mcpServers) {
        for (const server of Object.values(this.solutionConfig.mcpServers)) {
          server.args = server.args.map((arg) => {
            if (arg.endsWith('.js') || arg.endsWith('.ts')) {
              return join(this.solutionDir, arg);
            }
            return arg;
          });
        }
      }
    } catch (error) {
      console.warn('Could not load solution.json:', error);
    }
  }

  /**
   * GET /api/config
   * Returns solution configuration for frontend to use with CCAAS
   */
  @Get()
  getConfig() {
    if (!this.solutionConfig) {
      return {
        mcpServers: {},
        skillPath: null,
        skillSlug: null,
      };
    }

    // Construct absolute skill path
    const skillPath = this.solutionConfig.skill?.skillFile
      ? join(this.solutionDir, this.solutionConfig.skill.skillFile)
      : null;

    return {
      mcpServers: this.solutionConfig.mcpServers || {},
      skillPath,
      skillSlug: this.solutionConfig.slug,
    };
  }
}
