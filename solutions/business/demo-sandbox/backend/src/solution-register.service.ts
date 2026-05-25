/**
 * SolutionRegisterService — bootstrap + hot-reload skill registration
 * for the demo-sandbox solution.
 *
 * Responsibilities:
 *   1. On application bootstrap, register the solution (tenant +
 *      sessionTemplates) and all skill files with ccaas core.
 *   2. Watch the skills/ directory with chokidar — on any change,
 *      re-run the skill registration step so changes take effect for
 *      the NEXT session without restarting either backend.
 *
 * Why not use ccaas's `npm run skill:import` mechanism: that script is
 * disabled (`.ts.disabled`). The live path is the REST API:
 *   - POST /api/v1/admin/solutions/import   ← tenant + templates
 *   - POST /api/v1/skills                   ← per-skill, with SKILL.md content
 *   - PUT  /api/v1/skills/:id/files         ← additional skill files (progressive disclosure subdirs)
 *   - POST /api/v1/skills/:id/publish       ← make available to sessions
 *
 * All requests are tagged with `X-Tenant-Id: demo-sandbox` so ccaas's
 * TenantGuard resolves the right tenant context.
 */

import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import * as chokidar from 'chokidar';

const TENANT_SLUG = 'demo-sandbox';
const SOLUTION_ROOT = resolve(__dirname, '..', '..');
const SKILLS_ROOT = join(SOLUTION_ROOT, 'skills');

@Injectable()
export class SolutionRegisterService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SolutionRegisterService.name);
  private watcher?: chokidar.FSWatcher;
  private reregisterTimer?: NodeJS.Timeout;

  async onApplicationBootstrap(): Promise<void> {
    const ccaasUrl = process.env.CCAAS_URL ?? 'http://localhost:3001';
    const apiKey = process.env.CCAAS_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'CCAAS_API_KEY not set — solution will NOT auto-register with ccaas core. ' +
        'Set CCAAS_API_KEY=<your-admin-key> to enable.',
      );
      return;
    }

    await this.registerAll(ccaasUrl, apiKey);

    // Hot-reload watcher (debounced 500ms; only fires if API key present)
    this.watcher = chokidar.watch(SKILLS_ROOT, { ignoreInitial: true });
    this.watcher.on('all', (event, path) => {
      this.logger.log(`Detected ${event} on ${relative(SOLUTION_ROOT, path)} — scheduling re-register`);
      if (this.reregisterTimer) clearTimeout(this.reregisterTimer);
      this.reregisterTimer = setTimeout(() => {
        this.registerSkills(ccaasUrl, apiKey).catch((err) =>
          this.logger.error(`Re-register failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, 500);
    });
    this.logger.log(`Hot-reload watcher active on ${SKILLS_ROOT}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reregisterTimer) clearTimeout(this.reregisterTimer);
    await this.watcher?.close();
  }

  private async registerAll(ccaasUrl: string, apiKey: string): Promise<void> {
    try {
      await this.registerSolution(ccaasUrl, apiKey);
      await this.registerSkills(ccaasUrl, apiKey);
      this.logger.log(`Registration complete for tenant=${TENANT_SLUG}`);
    } catch (err) {
      this.logger.error(`Bootstrap registration failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async registerSolution(ccaasUrl: string, apiKey: string): Promise<void> {
    const configPath = join(SOLUTION_ROOT, 'solution.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    const resp = await fetch(`${ccaasUrl}/api/v1/admin/solutions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(config),
    });
    if (!resp.ok) {
      throw new Error(`solution/import HTTP ${resp.status}: ${await resp.text()}`);
    }
    const result = await resp.json();
    this.logger.log(`Solution registered: tenantId=${result.tenantId}`);
  }

  private async registerSkills(ccaasUrl: string, apiKey: string): Promise<void> {
    if (!existsSync(SKILLS_ROOT)) {
      this.logger.warn(`No skills/ directory at ${SKILLS_ROOT} — skipping skill registration`);
      return;
    }

    const skillSlugs = readdirSync(SKILLS_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const slug of skillSlugs) {
      const skillDir = join(SKILLS_ROOT, slug);
      const skillMdPath = join(skillDir, 'SKILL.md');
      if (!existsSync(skillMdPath)) {
        this.logger.warn(`Skipping ${slug}: no SKILL.md`);
        continue;
      }

      const content = readFileSync(skillMdPath, 'utf8');
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-tenant-id': TENANT_SLUG,
      };

      // 1. Upsert the skill (POST creates; if already exists, ccaas returns
      //    409, in which case we look up by slug and PUT to update).
      let skillId: string;
      const createResp = await fetch(`${ccaasUrl}/api/v1/skills`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: slug, slug, content }),
      });
      if (createResp.ok) {
        skillId = (await createResp.json()).id;
        this.logger.log(`Created skill ${slug} (id=${skillId})`);
      } else if (createResp.status === 409) {
        // Look up by slug then update content
        const found = await fetch(`${ccaasUrl}/api/v1/skills/${slug}`, { headers });
        if (!found.ok) throw new Error(`Lookup after 409 failed: HTTP ${found.status}`);
        skillId = (await found.json()).id;
        const updateResp = await fetch(`${ccaasUrl}/api/v1/skills/${skillId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ content }),
        });
        if (!updateResp.ok) throw new Error(`Update HTTP ${updateResp.status}: ${await updateResp.text()}`);
        this.logger.log(`Updated skill ${slug} (id=${skillId})`);
      } else {
        throw new Error(`Create skill HTTP ${createResp.status}: ${await createResp.text()}`);
      }

      // 2. Upsert the sub-files (tools/*.md, examples/*.md) so the agent
      //    can `cat` them during progressive disclosure.
      const files = this.collectSkillFiles(skillDir).filter((f) => f.relativePath !== 'SKILL.md');
      if (files.length > 0) {
        const upsertResp = await fetch(`${ccaasUrl}/api/v1/skills/${skillId}/files`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ files }),
        });
        if (!upsertResp.ok) {
          throw new Error(`Upsert files HTTP ${upsertResp.status}: ${await upsertResp.text()}`);
        }
        this.logger.log(`Upserted ${files.length} file(s) for ${slug}`);
      }

      // 3. Publish so sessions can use it
      const pubResp = await fetch(`${ccaasUrl}/api/v1/skills/${skillId}/publish`, {
        method: 'POST',
        headers,
      });
      if (!pubResp.ok && pubResp.status !== 409) {
        // 409 = already published — fine
        this.logger.warn(`Publish ${slug} HTTP ${pubResp.status}: ${await pubResp.text()}`);
      }
    }
  }

  /**
   * Recursively collect skill files relative to the skill directory.
   * Returns `[{ relativePath, content }]` for everything except SKILL.md
   * itself (which is the main `content` field on the skill).
   */
  private collectSkillFiles(skillDir: string): { relativePath: string; content: string }[] {
    const out: { relativePath: string; content: string }[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) {
          out.push({
            relativePath: relative(skillDir, full),
            content: readFileSync(full, 'utf8'),
          });
        }
      }
    };
    walk(skillDir);
    return out;
  }
}
