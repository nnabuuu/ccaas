/**
 * Development script to create an admin API key
 *
 * Usage: npm run create-dev-key
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ApiKeyService } from '../src/auth/api-key.service';
import { TenantsService } from '../src/tenants/tenants.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const apiKeyService = app.get(ApiKeyService);
  const tenantsService = app.get(TenantsService);

  try {
    // Get or create default tenant
    let tenant = await tenantsService.findOne('default');

    if (!tenant) {
      console.log('Creating default tenant...');
      tenant = await tenantsService.create({
        name: 'Default Tenant',
        slug: 'default',
        plan: 'free',
        maxSessions: 10,
        maxSkills: 20,
      });
      console.log(`✓ Created tenant: ${tenant.name} (${tenant.id})`);
    } else {
      console.log(`✓ Using existing tenant: ${tenant.name} (${tenant.id})`);
    }

    // Create admin API key
    console.log('\nCreating admin API key...');
    const result = await apiKeyService.create(tenant.id, {
      name: 'Dev Admin Key',
      scopes: ['admin'], // Admin scope grants access to all endpoints
      expiresAt: undefined, // No expiration
    });

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

  } catch (error) {
    console.error('Error creating API key:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
