/**
 * DashboardController + ObservationDashboardController auth tests —
 * pins the M5 pass-1 MF3 / SF6 tenant-binding guards. Without these,
 * a chat-scoped key from tenant A could read tenant B's session
 * observation rows (data-leak).
 *
 * Focus is the auth boundary, not the payload shape — payload shape
 * is covered by `dashboard.service.spec.ts` and
 * `observation-dashboard.spec.ts`.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ObservationDashboardController } from './observation-dashboard.controller';
import { ObservationDashboardProjector } from './observation-dashboard.projector';
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
class FakeProjector {
  projectCalls: Array<{ solutionId: string; sessionId: string }> = [];
  async project(solutionId: string, sessionId: string) {
    this.projectCalls.push({ solutionId, sessionId });
    return { logs: [], alerts: [], indicatorStats: [] };
  }
}

describe('DashboardController + ObservationDashboardController — auth guards', () => {
  let app: INestApplication;
  let module: TestingModule;
  let svc: FakeDashboardService;
  let projector: FakeProjector;

  async function bootWith(guard: typeof AllowAllTenantBound | typeof AllowAllNoTenant) {
    svc = new FakeDashboardService();
    projector = new FakeProjector();
    module = await Test.createTestingModule({
      controllers: [DashboardController, ObservationDashboardController],
      providers: [
        { provide: DashboardService, useValue: svc },
        { provide: ObservationDashboardProjector, useValue: projector },
      ],
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

  // ── DashboardController (M5.2 new endpoint) ──

  it('GET /dashboard succeeds when tenant is bound (DashboardController)', async () => {
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

  // ── ObservationDashboardController (M3 legacy projector endpoint) ──

  it('GET /observation-dashboard succeeds when tenant is bound', async () => {
    await bootWith(AllowAllTenantBound);
    await request(app.getHttpServer())
      .get('/api/v1/workflow/sessions/sess-1/observation-dashboard')
      .expect(200);
    expect(projector.projectCalls).toEqual([{ solutionId: TENANT, sessionId: 'sess-1' }]);
  });

  it('M5 pass-1 MF3: GET /observation-dashboard rejects with 400 when no tenant is bound', async () => {
    await bootWith(AllowAllNoTenant);
    await request(app.getHttpServer())
      .get('/api/v1/workflow/sessions/sess-1/observation-dashboard')
      .expect(400);
    expect(projector.projectCalls).toEqual([]);
  });
});
