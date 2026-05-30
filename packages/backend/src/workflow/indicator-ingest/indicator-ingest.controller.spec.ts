/**
 * IndicatorIngestController integration tests — validates the PUT
 * endpoint accepts a well-formed catalog, replaces idempotently,
 * rejects malformed payloads.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { IndicatorIngestController } from './indicator-ingest.controller';
import { IndicatorRegistryService } from '../llm/indicator-registry.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../auth/guards/scopes.guard';

class AllowAllGuard {
  canActivate() {
    return true;
  }
}

describe('IndicatorIngestController (PUT /workflow/sessions/:id/indicators)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let registry: IndicatorRegistryService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [IndicatorIngestController],
      providers: [IndicatorRegistryService],
    })
      .overrideGuard(ApiKeyGuard)
      .useClass(AllowAllGuard)
      .overrideGuard(ScopesGuard)
      .useClass(AllowAllGuard)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    registry = module.get(IndicatorRegistryService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a valid indicator catalog + replaces in the registry', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({
        indicators: [
          { id: 'K1', type: 'knowledge', label: 'concept', description: 'desc' },
          { id: 'M1', type: 'misconception', label: 'mix-up', description: 'desc2' },
        ],
      })
      .expect(204);
    expect(registry.getIndicators('sess-1')).toEqual([
      { id: 'K1', type: 'knowledge', label: 'concept', description: 'desc' },
      { id: 'M1', type: 'misconception', label: 'mix-up', description: 'desc2' },
    ]);
  });

  it('is idempotent (replace semantics on PUT)', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({
        indicators: [
          { id: 'K1', type: 'knowledge', label: 'a', description: '' },
        ],
      })
      .expect(204);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({
        indicators: [
          { id: 'M1', type: 'misconception', label: 'b', description: '' },
        ],
      })
      .expect(204);
    expect(registry.getIndicators('sess-1')).toEqual([
      { id: 'M1', type: 'misconception', label: 'b', description: '' },
    ]);
  });

  it('accepts an empty indicators array (clears the session)', async () => {
    registry.setIndicators('sess-1', [
      { id: 'K1', type: 'knowledge', label: 'a', description: '' },
    ]);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({ indicators: [] })
      .expect(204);
    expect(registry.getIndicators('sess-1')).toEqual([]);
  });

  it('rejects payloads missing required fields with 400', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({
        indicators: [
          { id: '', type: 'knowledge', label: 'x', description: 'd' },
        ],
      })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/v1/workflow/sessions/sess-1/indicators')
      .send({
        indicators: [{ id: 'K1', type: 'knowledge', label: '' }],
      })
      .expect(400);
  });
});
