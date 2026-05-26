/**
 * Development script to create an admin API key
 *
 * Usage:
 *   npm run create-dev-key                 — mints a key for the `default` tenant
 *   npm run create-dev-key -- <tenant-slug> — mints a key for the named tenant
 *                                              (e.g. `live-lesson-creator` for the
 *                                              agent-runtime poc-smoke flow)
 *   TENANT_SLUG=<slug> npm run create-dev-key — same via env var
 *
 * If `--raw-only` is passed as a second flag, emits ONLY the raw key on
 * stdout — used by `poc-smoke.sh` to capture the key with `$(...)`.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ApiKeyService } from '../src/auth/api-key.service';
import { TenantsService } from '../src/tenants/tenants.service';

async function bootstrap() {
  // Suppress NestJS' own bootstrap log lines when caller wants just the
  // raw key on stdout. Without this `$(node create-dev-api-key.ts ... --raw-only)`
  // would capture the "Nest application started" banner instead.
  const rawOnly = process.argv.includes('--raw-only');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: rawOnly ? false : undefined,
  });
  // Filter out the --raw-only flag before resolving the tenant slug.
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const tenantSlug = positional[0] ?? process.env.TENANT_SLUG ?? 'default';

  const apiKeyService = app.get(ApiKeyService);
  const tenantsService = app.get(TenantsService);

  try {
    // Get or create the requested tenant.
    let tenant = await tenantsService.findOne(tenantSlug);

    if (!tenant) {
      if (tenantSlug !== 'default') {
        console.error(
          `✗ tenant slug "${tenantSlug}" does not exist. ` +
          `Import its solution first (e.g. via SOLUTIONS_DIR + restart) ` +
          `or create the tenant manually.`,
        );
        process.exit(1);
      }
      if (!rawOnly) console.log('Creating default tenant...');
      tenant = await tenantsService.create({
        name: 'Default Tenant',
        slug: 'default',
        plan: 'free',
        maxSessions: 10,
        maxSkills: 20,
      });
      if (!rawOnly) console.log(`✓ Created tenant: ${tenant.name} (${tenant.id})`);
    } else if (!rawOnly) {
      console.log(`✓ Using existing tenant: ${tenant.name} (${tenant.id})`);
    }

    // Create admin API key
    if (!rawOnly) console.log('\nCreating admin API key...');
    const result = await apiKeyService.create(tenant.id, {
      name: `Dev Admin Key (${tenant.slug})`,
      scopes: ['admin'], // Admin scope grants access to all endpoints
      expiresAt: undefined, // No expiration
    });

    if (rawOnly) {
      // Single-line raw key; nothing else on stdout. stderr stays open
      // for the caller to peek at if they want.
      process.stdout.write(result.rawKey + '\n');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('✓ Admin API Key Created Successfully!');
      console.log('='.repeat(80));
      console.log('\nAPI Key:', result.rawKey);
      console.log('Key ID:', result.apiKey.id);
      console.log('Tenant:', tenant.name);
      console.log('Scopes:', result.apiKey.scopes.join(', '));
      console.log('\n⚠️  IMPORTANT: Save this key now! It cannot be retrieved later.');
      console.log('\nTo use with the admin dashboard:');
      console.log('1. Add to packages/admin-next/.env.local:');
      console.log(`   VITE_DEV_API_KEY=${result.rawKey}`);
      console.log('2. Restart the admin dashboard: cd packages/admin-next && npm run dev');
      console.log('3. You will be automatically logged in!');
      console.log('\nAlternatively, manually enter the key at http://localhost:5175/login');
      console.log('='.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('Error creating API key:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
