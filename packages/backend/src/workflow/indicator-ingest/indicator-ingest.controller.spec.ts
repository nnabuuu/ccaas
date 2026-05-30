/**
 * IndicatorIngestController integration tests — validates the PUT
 * endpoint accepts a well-formed catalog, replaces idempotently,
 * rejects malformed payloads, AND enforces tenant-bound auth
 * (M5 pass-1 MF3).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { IndicatorIngestController } from './indicator-ingest.controller';
import { IndicatorRegistryService } from '../llm/indicator-registry.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../auth/guards/scopes.guard';

const TENANT = 'tenant-indicator-test';
const TENANT_B = 'tenant-b';

/**
 * Stamps `req.solutionId` so `@TenantId()` resolves. Same shape as
 * EventIngestController's spec helper.
 */
class AllowAllGuardA {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    req.solutionId = TENANT;
    req.context = { solutionId: TENANT };
    return true;
  }
}

class AllowAllGuardB {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    req.solutionId = TENANT_B;
    req.context = { solutionId: TENANT_B };
    return true;
  }
}

/** No tenant context — exercises the "missing solutionId" branch. */
class AllowAllGuardNoTenant {
  canActivate() {
    return true;
  }
}

describe('IndicatorIngestController (PUT /workflow/sessions/:id/indicators)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let registry: IndicatorRegistryService;

  async function bootWith(guard: typeof AllowAllGuardA): Promise<void> {
    module = await Test.createTestingModule({
      controllers: [IndicatorIngestController],
      providers: [IndicatorRegistryService],
    })
      .overrideGuard(ApiKeyGuard)
      .useClass(guard)
      .overrideGuard(ScopesGuard)
      .useClass(guard)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    registry = module.get(IndicatorRegistryService);
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it('accepts a valid indicator catalog + replaces in the registry under the tenant', async () => {
    await bootWith(AllowAllGuardA);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({
        indicators: [
          { id: 'K1', type: 'knowledge', label: 'concept', description: 'desc' },
          { id: 'M1', type: 'misconception', label: 'mix-up', description: 'desc2' },
        ],
      })
      .expect(204);
    expect(registry.getIndicators(TENANT, 'sess-1')).toEqual([
      { id: 'K1', type: 'knowledge', label: 'concept', description: 'desc' },
      { id: 'M1', type: 'misconception', label: 'mix-up', description: 'desc2' },
    ]);
  });

  it('is idempotent (replace semantics on PUT)', async () => {
    await bootWith(AllowAllGuardA);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({ indicators: [{ id: 'K1', type: 'knowledge', label: 'a', description: '' }] })
      .expect(204);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({ indicators: [{ id: 'M1', type: 'misconception', label: 'b', description: '' }] })
      .expect(204);
    expect(registry.getIndicators(TENANT, 'sess-1')).toEqual([
      { id: 'M1', type: 'misconception', label: 'b', description: '' },
    ]);
  });

  it('accepts an empty indicators array (clears the tenant-session catalog)', async () => {
    await bootWith(AllowAllGuardA);
    registry.setIndicators(TENANT, 'sess-1', [
      { id: 'K1', type: 'knowledge', label: 'a', description: '' },
    ]);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({ indicators: [] })
      .expect(204);
    expect(registry.getIndicators(TENANT, 'sess-1')).toEqual([]);
  });

  it('rejects payloads missing required fields with 400', async () => {
    await bootWith(AllowAllGuardA);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({ indicators: [{ id: '', type: 'knowledge', label: 'x', description: 'd' }] })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({ indicators: [{ id: 'K1', type: 'knowledge', label: '' }] })
      .expect(400);
  });

  it('M5 pass-1 MF3: rejects PUT when no tenant is bound to the auth context', async () => {
    await bootWith(AllowAllGuardNoTenant);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({ indicators: [] })
      .expect(400);
  });

  it('M5 pass-1 MF3: tenant A cannot read tenant B catalog (cross-tenant isolation)', async () => {
    await bootWith(AllowAllGuardA);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/shared-session-id/indicators')
      .send({ indicators: [{ id: 'K1', type: 'knowledge', label: 'A', description: 'A' }] })
      .expect(204);
    // Tenant A's data lives under (TENANT, sessId); tenant B sees nothing.
    expect(registry.getIndicators(TENANT, 'shared-session-id')).toEqual([
      { id: 'K1', type: 'knowledge', label: 'A', description: 'A' },
    ]);
    expect(registry.getIndicators(TENANT_B, 'shared-session-id')).toEqual([]);
  });
});
