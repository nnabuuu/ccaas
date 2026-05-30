/**
 * SessionLifecycleController tests — pins the M6 pass-1 S1 contract:
 * DELETE /api/v1/workflow/sessions/:sessionId clears the platform's
 * per-session state.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SessionLifecycleController } from './session-lifecycle.controller';
import { WorkflowEngineService } from '../workflow-engine.service';
import { IndicatorRegistryService } from '../llm/indicator-registry.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../auth/guards/scopes.guard';

const TENANT = 'tenant-lifecycle-test';

class AllowAllTenantBound {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    req.solutionId = TENANT;
    req.context = { solutionId: TENANT };
    return true;
  }
}

class AllowAllNoTenant {
  canActivate() {
    return true;
  }
}

class FakeEngine {
  clearSessionQueueCalls: string[] = [];
  clearSessionQueue(sessionId: string): void {
    this.clearSessionQueueCalls.push(sessionId);
  }
  // The DELETE controller doesn't call clearSession (broad) — it
  // calls clearSessionQueue (narrow) + IndicatorRegistry tenant-scoped
  // clear. Keep this present as a no-op so future controller changes
  // that accidentally call it surface in the test as an unexpected
  // empty array, not a TypeError.
  clearSession(_sessionId: string): void {
    // intentionally empty
  }
}

describe('SessionLifecycleController', () => {
  let app: INestApplication;
  let module: TestingModule;
  let engine: FakeEngine;
  let indicators: IndicatorRegistryService;

  async function bootWith(guard: typeof AllowAllTenantBound | typeof AllowAllNoTenant) {
    engine = new FakeEngine();
    module = await Test.createTestingModule({
      controllers: [SessionLifecycleController],
      providers: [
        { provide: WorkflowEngineService, useValue: engine },
        IndicatorRegistryService,
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useClass(guard)
      .overrideGuard(ScopesGuard)
      .useClass(guard)
      .compile();
    app = module.createNestApplication();
    await app.init();
    indicators = module.get(IndicatorRegistryService);
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it('clears engine + indicator state for the session', async () => {
    await bootWith(AllowAllTenantBound);
    indicators.setIndicators(TENANT, 'sess-1', [
      { id: 'K1', type: 'knowledge', label: 'a', description: '' },
    ]);
    expect(indicators.getIndicators(TENANT, 'sess-1')).toHaveLength(1);
    await request(app.getHttpServer())
      .delete('/api/v1/workflow/sessions/sess-1')
      .expect(204);
    expect(engine.clearSessionQueueCalls).toEqual(['sess-1']);
    expect(indicators.getIndicators(TENANT, 'sess-1')).toEqual([]);
  });

  it('M6 pass-2 SF3: tenant-scoped — does not drop another tenant\'s catalog', async () => {
    await bootWith(AllowAllTenantBound);
    const TENANT_B = 'tenant-b';
    indicators.setIndicators(TENANT, 'shared-session', [
      { id: 'K1', type: 'knowledge', label: 'A', description: '' },
    ]);
    indicators.setIndicators(TENANT_B, 'shared-session', [
      { id: 'M1', type: 'misconception', label: 'B', description: '' },
    ]);
    await request(app.getHttpServer())
      .delete('/api/v1/workflow/sessions/shared-session')
      .expect(204);
    // Tenant A's catalog cleared.
    expect(indicators.getIndicators(TENANT, 'shared-session')).toEqual([]);
    // Tenant B's catalog untouched — auth boundary and teardown boundary
    // agree.
    expect(indicators.getIndicators(TENANT_B, 'shared-session')).toEqual([
      { id: 'M1', type: 'misconception', label: 'B', description: '' },
    ]);
  });

  it('is idempotent (unknown session → 204)', async () => {
    await bootWith(AllowAllTenantBound);
    await request(app.getHttpServer())
      .delete('/api/v1/workflow/sessions/never-existed')
      .expect(204);
    expect(engine.clearSessionQueueCalls).toEqual(['never-existed']);
  });

  it('400 when no tenant is bound to the auth context', async () => {
    await bootWith(AllowAllNoTenant);
    await request(app.getHttpServer())
      .delete('/api/v1/workflow/sessions/sess-1')
      .expect(400);
    expect(engine.clearSessionQueueCalls).toEqual([]);
  });
});

/**
 * M6 pass-2 SF5 — integration test with the real WorkflowEngineService
 * (no FakeEngine) so the engine→IndicatorRegistry cascade wired in
 * M5 pass-1 SF1 stays covered. If a future refactor broke that
 * cascade, the controller's belt-and-suspenders explicit
 * `indicators.clearTenantSession` call would still pass the
 * unit-level tests above; this integration test pins both paths.
 */
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { ManifestAccessorService } from '../../ontology/manifest-accessor.service';
import { WorkflowMetricsService } from '../workflow-metrics.service';
import { WorkflowRegistry } from '../workflow-registry';

class FakeManifestAccessor {
  publishCalls: unknown[] = [];
  publish(_s: string, _stream: string, payload: unknown): void {
    this.publishCalls.push(payload);
  }
  onStateChange(): () => void {
    return () => undefined;
  }
}

describe('SessionLifecycleController — integration with real engine cascade', () => {
  let app: INestApplication;
  let module: TestingModule;
  let engine: WorkflowEngineService;
  let indicators: IndicatorRegistryService;
  const TENANT_INT = 'tenant-int-test';

  beforeEach(async () => {
    const fake = new FakeManifestAccessor();
    module = await Test.createTestingModule({
      controllers: [SessionLifecycleController],
      providers: [
        WorkflowRegistry,
        WorkflowMetricsService,
        WorkflowEngineService,
        DiscoveryService,
        MetadataScanner,
        IndicatorRegistryService,
        { provide: ManifestAccessorService, useValue: fake },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.solutionId = TENANT_INT;
          req.context = { solutionId: TENANT_INT };
          return true;
        },
      })
      .overrideGuard(ScopesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await module.init();
    await app.init();
    engine = module.get(WorkflowEngineService);
    indicators = module.get(IndicatorRegistryService);
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('engine.clearSession cascade drops indicators for this tenant', async () => {
    indicators.setIndicators(TENANT_INT, 'sess-int-1', [
      { id: 'K1', type: 'knowledge', label: 'a', description: '' },
    ]);
    expect(indicators.getIndicators(TENANT_INT, 'sess-int-1')).toHaveLength(1);
    // Direct engine.clearSession (not via the controller) to test the
    // cascade itself. The controller path is covered by the FakeEngine
    // tests above.
    engine.clearSession('sess-int-1');
    expect(indicators.getIndicators(TENANT_INT, 'sess-int-1')).toEqual([]);
  });
});
