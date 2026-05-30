/**
 * `@WorkflowTrigger(def)` — decorator that marks a class as carrying
 * a `TriggerDef`. Nest's `DiscoveryService` (driven from
 * `WorkflowEngineService.onApplicationBootstrap`) scans `@Injectable()`
 * providers for the metadata key and registers each found trigger
 * with `WorkflowRegistry`.
 *
 * Pattern mirrors `@kedge-agentic/observer-engine`'s `@ObserverHandler`
 * but at the trigger granularity, not method-level. The class itself
 * is the action handler (or holds the handler as a method); the
 * decorator carries the trigger metadata via reflection.
 *
 * Why class-level: a trigger + its action handler is one unit. Phase 3
 * showed that splitting them across files creates indirection during
 * code review. M2's `JoinTrigger` will exemplify the shape:
 *
 *   @Injectable()
 *   @WorkflowTrigger({
 *     apiName: 'on_student_joined_record_lifecycle',
 *     manifest: 'LessonSession',
 *     kind: 'event',
 *     watch: { stream: 'events' },
 *     when: (input) => isStudentJoinedPayload(input.event!.payload),
 *     then: { action: 'record_lifecycle_observation', args: mapJoinToArgs },
 *   })
 *   export class JoinTrigger { ... }
 */

import { SetMetadata } from '@nestjs/common';
import type { TriggerDef } from './types';

export const WORKFLOW_TRIGGER_METADATA = '__workflow_trigger__';

export const WorkflowTrigger = (def: TriggerDef) =>
  SetMetadata(WORKFLOW_TRIGGER_METADATA, def);
