/**
 * Minimal test-only manifest for event-ingest controller specs.
 *
 * Phase 5.5 carved out the live-lesson `LessonSessionManifest` to a
 * separate workspace package. Core's event-ingest spec used to pull
 * that manifest as a convenient fixture for the payload-validation
 * gate. To keep the core spec genuinely solution-agnostic (so
 * `packages/backend/` neither imports nor names any teaching-domain
 * concept), we define a stripped-down generic manifest here. Names +
 * payload variants are deliberately neutral (`TestSession`,
 * `entity_join`, `entityRefId`) — pass-1 N1.
 *
 * Test-only; not registered at runtime. Lives under `test/` so it's
 * excluded from the published dist.
 */

import { z } from 'zod';
import { defineManifest, type ManifestDef, type StreamDef } from '@kedge-agentic/ontology';

const TestEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('entity_join'),
    entityRefId: z.string(),
    sessionRef: z.string(),
  }),
  z.object({
    type: z.literal('generic_event'),
    data: z.record(z.unknown()).optional(),
  }),
]);

const eventsStream: StreamDef = {
  apiName: 'events',
  displayName: 'Test Events',
  payloadSchema: TestEventPayloadSchema,
  semantic: 'Test-only stream for event-ingest specs.',
  backpressure: 'drop_oldest',
};

export const EventIngestTestManifest: ManifestDef = defineManifest({
  name: 'TestSession',
  displayName: 'Test Manifest (phase 5.5 fixture)',
  schemaVersion: '0.1.0',
  semantic: 'Test-only fixture; not a real solution manifest.',
  slots: [],
  state: [],
  streams: [eventsStream],
  boundaries: [
    {
      role: 'admin',
      readable: ['*'],
      writable: ['*'],
      actions: ['*'],
      subscribes: ['events'],
    },
  ],
});
