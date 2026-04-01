import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';

@Injectable()
export class SolutionRegisterService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SolutionRegisterService.name);

  async onApplicationBootstrap() {
    const ccaasUrl = process.env.CCAAS_URL;
    const apiKey = process.env.CCAAS_API_KEY;
    if (!ccaasUrl || !apiKey) {
      this.logger.warn(
        'CCAAS_URL or CCAAS_API_KEY not set, skipping solution registration',
      );
      return;
    }

    try {
      const solutionDir = resolve(__dirname, '../..');
      const configPath = join(solutionDir, 'solution.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));

      // Resolve MCP args to absolute paths so Core Backend can spawn them
      if (config.mcpServers) {
        for (const server of Object.values(config.mcpServers) as any[]) {
          if (server.args) {
            server.args = server.args.map((a: string) =>
              a.endsWith('.js') || a.endsWith('.mjs')
                ? resolve(solutionDir, a)
                : a,
            );
          }
        }
      }

      const resp = await fetch(`${ccaasUrl}/api/v1/admin/solutions/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(config),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      }

      const result = await resp.json();
      this.logger.log(
        `Registered with core backend: tenant=${result.tenantId}, ${result.templateCount} templates`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to register solution with core backend: ${err.message}`,
      );
    }
  }
}
