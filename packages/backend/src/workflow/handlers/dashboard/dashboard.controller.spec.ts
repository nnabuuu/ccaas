/**
 * DashboardController auth tests — pins the M5 pass-1 MF3 / SF6
 * tenant-binding guard. Without it, a chat-scoped key from tenant A
 * could read tenant B's session observation rows (data-leak).
 *
 * Focus is the auth boundary, not the payload shape — payload shape
 * is covered by `dashboard.service.spec.ts`. The legacy
 * `ObservationDashboardController` was deleted in M5.2a together
 * with the projector; this spec only covers the new endpoint.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ApiKeyGuard } from '../../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../../auth/guards/scopes.guard';

const TENANT = 'tenant-dash-test';

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

class FakeDashboardService {
  buildPayloadCalls: Array<{ solutionId: string; sessionId: string }> = [];
  async buildPayload(solutionId: string, sessionId: string) {
    this.buildPayloadCalls.push({ solutionId, sessionId });
    return {
      sessionId,
      indicators: [],
      students: [],
      generatedAt: 0,
    };
  }
}

describe('DashboardController — auth guard', () => {
  let app: INestApplication;
  let module: TestingModule;
  let svc: FakeDashboardService;

  async function bootWith(guard: typeof AllowAllTenantBound | typeof AllowAllNoTenant) {
    svc = new FakeDashboardService();
    module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: svc }],
    })
      .overrideGuard(ApiKeyGuard)
      .useClass(guard)
      .overrideGuard(ScopesGuard)
      .useClass(guard)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it('GET /dashboard succeeds when tenant is bound', async () => {
    await bootWith(AllowAllTenantBound);
    await request(app.getHttpServer())
      .get('/api/v1/workflow/sessions/sess-1/dashboard')
      .expect(200);
    expect(svc.buildPayloadCalls).toEqual([{ solutionId: TENANT, sessionId: 'sess-1' }]);
  });

  it('M5 pass-1 MF3: GET /dashboard rejects with 400 when no tenant is bound', async () => {
    await bootWith(AllowAllNoTenant);
    await request(app.getHttpServer())
      .get('/api/v1/workflow/sessions/sess-1/dashboard')
      .expect(400);
    expect(svc.buildPayloadCalls).toEqual([]);
  });
});
