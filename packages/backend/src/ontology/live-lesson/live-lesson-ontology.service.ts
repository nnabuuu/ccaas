/**
 * `LiveLessonOntologyService` — registers the live-lesson ontology
 * (ObjectTypes + Manifest + ActionDef-routed Tool) at backend boot.
 *
 * Why co-located in the platform backend (not in
 * `solutions/business/live-lesson/backend/`):
 *
 *   - `OntologyRegistry` + `SolutionToolkitRegistry` live in this
 *     process (port 3001). The live-lesson backend (port 3007) cannot
 *     register tools into a registry it doesn't share, and the platform
 *     doesn't yet expose a wire protocol for remote registration.
 *
 *   - Phase 3 ships the bridge here so the end-to-end pipeline
 *     (manifest + ActionDef + checkBoundary + audit) is observable in
 *     one process. A follow-up (post-PoC) introduces a registration
 *     hook on `solution.json` so Solutions can express ontology
 *     contributions declaratively. See docs/ontology/PROGRESS.md
 *     for the rollout plan.
 *
 * Registration happens in `onModuleInit` so the registry is populated
 * before any session boots. After registration the registry is sealed
 * — accidental late writes throw rather than silently mutating.
 */

import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { OntologyRegistry } from '@kedge-agentic/ontology';
import { SolutionToolkitRegistry } from '../../tool-caller/solution-toolkit-registry';
import { ONTOLOGY_REGISTRY } from '../ontology-registry.provider';
import { compileActionToToolDefinition } from '../action-to-tool-definition';
import { LIVE_LESSON_OBJECT_TYPES } from './object-types';
import { LessonSessionManifest } from './lesson-session.manifest';
import {
  EmitTodoCardAction,
  emitTodoCardHandler,
} from './actions/emit-todo-card.action';

export const LIVE_LESSON_SOLUTION_ID = 'live-lesson';
/**
 * Namespace under which ActionDef-routed tools register. Distinct from
 * the legacy stdio `creator` namespace so both paths coexist while
 * live-lesson migrates.
 */
export const LIVE_LESSON_ACTION_NAMESPACE = 'creator-actions';

@Injectable()
export class LiveLessonOntologyService implements OnModuleInit {
  private readonly logger = new Logger(LiveLessonOntologyService.name);

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly toolkits: SolutionToolkitRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    // ObjectTypes first — manifest validators look these up by apiName.
    for (const t of LIVE_LESSON_OBJECT_TYPES) {
      this.registry.registerObjectType(t);
    }
    this.registry.registerManifest(LessonSessionManifest);

    try {
      this.registry.seal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Live-lesson ontology registration sealed-validate failed: ${msg}`,
      );
      throw err;
    }

    const emitTodo = compileActionToToolDefinition(
      EmitTodoCardAction,
      emitTodoCardHandler,
      LessonSessionManifest,
    );

    this.toolkits.registerToolkit({
      solutionId: LIVE_LESSON_SOLUTION_ID,
      namespace: LIVE_LESSON_ACTION_NAMESPACE,
      tools: [emitTodo],
    });

    this.logger.log(
      `Live-lesson ontology registered: ${LIVE_LESSON_OBJECT_TYPES.length} object types, ` +
        `manifest "${LessonSessionManifest.name}", 1 action tool ` +
        `"${LIVE_LESSON_ACTION_NAMESPACE}.${EmitTodoCardAction.apiName}".`,
    );
  }
}
