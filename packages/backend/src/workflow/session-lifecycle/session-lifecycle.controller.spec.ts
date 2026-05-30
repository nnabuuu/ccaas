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
  clearSessionCalls: string[] = [];
  clearSession(sessionId: string): void {
    this.clearSessionCalls.push(sessionId);
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
    expect(engine.clearSessionCalls).toEqual(['sess-1']);
    expect(indicators.getIndicators(TENANT, 'sess-1')).toEqual([]);
  });

  it('is idempotent (unknown session → 204)', async () => {
    await bootWith(AllowAllTenantBound);
    await request(app.getHttpServer())
      .delete('/api/v1/workflow/sessions/never-existed')
      .expect(204);
    expect(engine.clearSessionCalls).toEqual(['never-existed']);
  });

  it('400 when no tenant is bound to the auth context', async () => {
    await bootWith(AllowAllNoTenant);
    await request(app.getHttpServer())
      .delete('/api/v1/workflow/sessions/sess-1')
      .expect(400);
    expect(engine.clearSessionCalls).toEqual([]);
  });
});
