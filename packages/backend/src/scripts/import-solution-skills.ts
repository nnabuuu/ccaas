#!/usr/bin/env node
/**
 * Import Solution Skills Script
 *
 * Registers skills, MCP servers, and tenant from solution.json to CCAAS backend database.
 * Supports both v1 (flat) and v2 (structured) solution.json formats.
 * Supports SKILL.md frontmatter parsing for skill metadata.
 *
 * Usage:
 *   npm run skill:import -- quiz-analyzer
 *   npm run skill:import -- lesson-plan-designer
 *   npm run skill:import -- quiz-analyzer --verbose
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SolutionLoaderService, type LoadResult } from '../solutions/solution-loader.service';

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const solutionName = args.find((a) => !a.startsWith('-'));

if (!solutionName) {
  console.error('\n  Usage: npm run skill:import -- <solution-name> [--verbose]');
  console.error('  Example: npm run skill:import -- quiz-analyzer');
  console.error('  Example: npm run skill:import -- lesson-plan-designer --verbose\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function importSolution(slug: string) {
  console.log(`\n  Importing solution: ${slug}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: verbose ? ['log', 'error', 'warn', 'debug'] : ['error', 'warn'],
  });

  try {
    const loader = app.get(SolutionLoaderService);
    const result = await loader.loadOne(slug);

    printResult(result);
  } catch (error) {
    console.error('\n  Import failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printResult(result: LoadResult) {
  const created = result.skills.filter((s) => s.action === 'created');
  const updated = result.skills.filter((s) => s.action === 'updated');
  const skipped = result.skills.filter((s) => s.action === 'skipped');

  const mcpCreated = result.mcpServers.filter((m) => m.action === 'created');
  const mcpUpdated = result.mcpServers.filter((m) => m.action === 'updated');
  const mcpSkipped = result.mcpServers.filter((m) => m.action === 'skipped');

  // Tenant
  console.log(`  Tenant: ${result.slug} (${result.tenantId})`);

  // Skills detail (verbose)
  if (verbose) {
    console.log(`\n  Skills:`);
    for (const s of result.skills) {
      const icon = s.action === 'created' ? '+' : s.action === 'updated' ? '~' : '!';
      const suffix = s.error ? ` (${s.error})` : s.skillId ? ` (${s.skillId})` : '';
      console.log(`    [${icon}] ${s.slug}${suffix}`);
    }

    if (result.mcpServers.length > 0) {
      console.log(`\n  MCP Servers:`);
      for (const m of result.mcpServers) {
        const icon = m.action === 'created' ? '+' : m.action === 'updated' ? '~' : '!';
        const suffix = m.error ? ` (${m.error})` : m.serverId ? ` (${m.serverId})` : '';
        console.log(`    [${icon}] ${m.slug}${suffix}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\n  Warnings:`);
      for (const w of result.warnings) {
        console.log(`    - ${w}`);
      }
    }
  }

  // Summary
  console.log('\n' + '-'.repeat(60));
  console.log(`\n  Import complete!\n`);
  console.log(`  Summary:`);
  console.log(`    Skills:  ${created.length} created, ${updated.length} updated${skipped.length ? `, ${skipped.length} skipped` : ''}`);
  if (result.mcpServers.length > 0) {
    console.log(`    MCP:     ${mcpCreated.length} created, ${mcpUpdated.length} updated${mcpSkipped.length ? `, ${mcpSkipped.length} skipped` : ''}`);
  }
  if (result.templateCount !== undefined && result.templateCount > 0) {
    console.log(`    Templates: ${result.templateCount} synced`);
  }
  console.log(`    Tenant:  ${result.slug} (${result.tenantId})`);
  console.log('');

  // Verification
  console.log('  Verification:');
  console.log(`    curl "http://localhost:3001/api/v1/skills?tenantId=${result.slug}"`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

importSolution(solutionName).catch((err) => {
  console.error('\n  Unexpected error:', err);
  process.exit(1);
});
