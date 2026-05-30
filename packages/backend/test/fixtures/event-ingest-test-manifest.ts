/**
 * Minimal test-only manifest for event-ingest controller specs.
 *
 * Phase 5.5 carved out the live-lesson `LessonSessionManifest` to a
 * separate workspace package. Core's event-ingest spec used to pull
 * that manifest as a convenient fixture for the payload-validation
 * gate. To keep the core spec generic (no solution dependency), we
 * define a stripped-down manifest here with the same wire-level shape
 * (`name: 'LessonSession'`, single `events` stream with a payload
 * schema that admits the spec's request bodies). Test-only; not
 * registered at runtime. Lives under `test/` so it's excluded from
 * the published dist.
 */

import { z } from 'zod';
import { defineManifest, type ManifestDef, type StreamDef } from '@kedge-agentic/ontology';

const TestEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('student_joined'),
    studentId: z.string(),
    classroomCode: z.string(),
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
  name: 'LessonSession',
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
