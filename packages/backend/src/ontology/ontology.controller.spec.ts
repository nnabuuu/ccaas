/**
 * Integration test for GET /api/v1/ontology/schema.
 *
 * Asserts ETag round-trip: first call returns 200 + sha256 ETag, and
 * a second call with matching If-None-Match returns 304 + empty body.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { z } from 'zod';
import { OntologyRegistry } from '@kedge-agentic/ontology';
import type { ObjectTypeDef } from '@kedge-agentic/ontology';
import { OntologyController } from './ontology.controller';
import { ONTOLOGY_REGISTRY } from './ontology-registry.provider';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

class AllowAllGuard {
  canActivate() {
    return true;
  }
}

describe('OntologyController (integration)', () => {
  let app: INestApplication;
  let registry: OntologyRegistry;

  beforeAll(async () => {
    registry = new OntologyRegistry();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OntologyController],
      providers: [
        { provide: ONTOLOGY_REGISTRY, useValue: registry },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with serialized schema + sha256 ETag on first call', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ontology/schema')
      .expect(200);

    expect(res.header.etag).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(res.body).toMatchObject({
      ontologyVersion: expect.any(String),
      objectTypes: expect.any(Array),
      manifests: expect.any(Array),
      functions: expect.any(Array),
    });
  });

  it('returns 304 with empty body when If-None-Match matches', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/ontology/schema')
      .expect(200);
    const etag = first.header.etag as string;

    const second = await request(app.getHttpServer())
      .get('/api/v1/ontology/schema')
      .set('If-None-Match', etag)
      .expect(304);

    expect(second.body).toEqual({});
    expect(second.text === '' || second.text === undefined).toBe(true);
  });

  it('ETag changes when registry contents change (regression for stale cache)', async () => {
    const before = (
      await request(app.getHttpServer()).get('/api/v1/ontology/schema').expect(200)
    ).header.etag as string;

    const dynamicType: ObjectTypeDef = {
      apiName: 'TestEntity',
      displayName: 'Test Entity',
      semantic: 'placeholder',
      schema: z.object({ id: z.string() }),
      links: [],
      actions: [],
    };
    registry.registerObjectType(dynamicType);

    const after = (
      await request(app.getHttpServer()).get('/api/v1/ontology/schema').expect(200)
    ).header.etag as string;

    expect(after).not.toBe(before);
    expect(after).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
