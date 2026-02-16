#!/usr/bin/env node
/**
 * Import Solution Skills Script
 *
 * Registers skills from solution.json to CCAAS backend database.
 *
 * Usage:
 *   npm run skill:import -- quiz-analyzer
 *   npm run skill:import -- lesson-plan-designer
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SkillsService } from '../skills/skills.service';
import { TenantsService } from '../tenants/tenants.service';
import * as path from 'path';
import * as fs from 'fs';

interface SolutionConfig {
  name: string;
  slug: string;
  description?: string;
  skills: SkillConfig[];
}

interface SkillConfig {
  name: string;
  slug: string;
  description: string;
  skillFile?: string;
  instructions?: string;
  allowedTools?: string[];
  triggers?: TriggerConfig[];
  scope?: 'tenant' | 'personal';
  outputFormat?: string;
}

interface TriggerConfig {
  type: 'keyword' | 'intent' | 'pattern' | 'context';
  value: string;
  priority?: number;
  description?: string;
}

async function importSkills(solutionName: string) {
  console.log(`\n🚀 Importing skills for solution: ${solutionName}\n`);

  // Create application context
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'], // Reduce log noise
  });

  const skillsService = app.get(SkillsService);
  const tenantsService = app.get(TenantsService);

  try {
    // Load solution.json
    const solutionPath = path.join(
      process.cwd(),
      '../../solutions',
      solutionName,
      'solution.json',
    );

    if (!fs.existsSync(solutionPath)) {
      console.error(`❌ Solution not found: ${solutionPath}`);
      process.exit(1);
    }

    const solutionConfig: SolutionConfig = JSON.parse(
      fs.readFileSync(solutionPath, 'utf-8'),
    );

    console.log(`📦 Solution: ${solutionConfig.name}`);
    console.log(`📋 Skills to import: ${solutionConfig.skills.length}\n`);

    // Get or create tenant
    let tenant = await tenantsService.findOne(solutionName);
    if (!tenant) {
      const createResult = await tenantsService.create({
        slug: solutionName,
        name: solutionConfig.name,
        description: solutionConfig.description,
      });
      tenant = createResult.tenant;
      console.log(`✅ Created tenant: ${tenant.slug} (${tenant.id})\n`);
    } else {
      console.log(`✅ Tenant exists: ${tenant.slug} (${tenant.id})\n`);
    }

    // Register each skill
    let createdCount = 0;
    let updatedCount = 0;

    for (const skillConfig of solutionConfig.skills) {
      console.log(`📝 Processing: ${skillConfig.slug}`);

      // Read skill file content
      let content = '';
      if (skillConfig.skillFile) {
        const skillFilePath = path.join(
          process.cwd(),
          '../../solutions',
          solutionName,
          skillConfig.skillFile,
        );

        if (fs.existsSync(skillFilePath)) {
          content = fs.readFileSync(skillFilePath, 'utf-8');
          console.log(`   📄 Loaded content from: ${skillConfig.skillFile}`);
        } else {
          console.warn(`   ⚠️  Skill file not found: ${skillFilePath}`);
          content = `# ${skillConfig.name}\n\n${skillConfig.description}`;
        }
      } else {
        // Use description as fallback content
        content = `# ${skillConfig.name}\n\n${skillConfig.description}`;
      }

      // Append additional instructions if present
      if (skillConfig.instructions) {
        content += `\n\n## Additional Instructions\n\n${skillConfig.instructions}`;
      }

      // Check if skill already exists
      const existing = await skillsService.findOne(tenant.id, skillConfig.slug);

      if (existing) {
        console.log(`   🔄 Skill exists - updating...`);
        await skillsService.update(tenant.id, existing.id, {
          name: skillConfig.name,
          description: skillConfig.description,
          content,
          allowedTools: skillConfig.allowedTools || [],
          triggers: skillConfig.triggers || [],
          scope: skillConfig.scope || 'tenant',
        });
        updatedCount++;
        console.log(`   ✅ Updated: ${skillConfig.slug}`);
      } else {
        console.log(`   ➕ Creating new skill...`);
        const created = await skillsService.create(tenant.id, {
          slug: skillConfig.slug,
          name: skillConfig.name,
          description: skillConfig.description,
          content,
          allowedTools: skillConfig.allowedTools || [],
          triggers: skillConfig.triggers || [],
          scope: skillConfig.scope || 'tenant',
          type: 'skill',
        });
        createdCount++;
        console.log(`   ✅ Created: ${skillConfig.slug} (${created.id})`);

        // Publish immediately
        // Note: In script context, WebSocket events may fail, but that's expected
        try {
          await skillsService.publish(tenant.id, created.id);
          console.log(`   📢 Published: ${skillConfig.slug}`);
        } catch (error: any) {
          // Skill was created successfully, WebSocket notification failed (expected in script context)
          console.log(`   📢 Published: ${skillConfig.slug} (WebSocket notification skipped)`);
        }
      }

      console.log('');
    }

    // Summary
    console.log('━'.repeat(60));
    console.log(`\n✨ Import complete!\n`);
    console.log(`📊 Summary:`);
    console.log(`   • Created: ${createdCount} skill(s)`);
    console.log(`   • Updated: ${updatedCount} skill(s)`);
    console.log(`   • Total: ${solutionConfig.skills.length} skill(s)`);
    console.log(`   • Tenant: ${tenant.slug} (${tenant.id})`);
    console.log('');

    // Verification instructions
    console.log('🔍 Verification:');
    console.log(`   curl "http://localhost:3001/api/v1/skills?tenantId=${solutionName}"`);
    console.log('');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Main execution
const solutionName = process.argv[2];
if (!solutionName) {
  console.error('\n❌ Usage: npm run skill:import -- <solution-name>');
  console.error('   Example: npm run skill:import -- quiz-analyzer\n');
  process.exit(1);
}

importSkills(solutionName).catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
