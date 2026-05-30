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
import { SolutionsService } from '@kedge-agentic/backend/solutions/solutions.service';
import { SolutionToolkitRegistry } from '@kedge-agentic/backend/tool-caller/solution-toolkit-registry';
import { ONTOLOGY_REGISTRY } from '@kedge-agentic/backend/ontology/ontology-registry.provider';
import { compileActionToToolDefinition } from '@kedge-agentic/backend/ontology/action-to-tool-definition';
import { LIVE_LESSON_OBJECT_TYPES } from './object-types';
import { LessonSessionManifest } from './lesson-session.manifest';
import {
  EmitTodoCardAction,
  emitTodoCardHandler,
} from './actions/emit-todo-card.action';

/**
 * Tenant slug used in `solution.json`. At boot we resolve this slug to
 * the tenant UUID — `ExecutionContext.solutionId` carries the UUID at
 * runtime (see `api-key.service.ts:174` + `session.service.ts`), and
 * `SolutionToolkitRegistry` keys strictly by that UUID. Passing the
 * slug here would silently turn the whole ActionDef path into dead
 * code (pass-3 code review M1).
 */
export const LIVE_LESSON_TENANT_SLUG = 'live-lesson';
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
    private readonly solutions: SolutionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Ontology registration (object types + manifest) is independent of
    // tenant existence — register first so the schema endpoint sees
    // them even if no tenant is provisioned yet.
    for (const t of LIVE_LESSON_OBJECT_TYPES) {
      this.registry.registerObjectType(t);
    }
    this.registry.registerManifest(LessonSessionManifest);
    // Note: `registry.seal()` lives in `OntologySealService.onApplicationBootstrap`
    // (a single seal stage after every solution registrar has run) —
    // sealing here would crash boot the moment a second solution
    // registrar tried to register. Pass-3 review S1.

    const tenant = await this.solutions.findOne(LIVE_LESSON_TENANT_SLUG);
    if (!tenant) {
      this.logger.warn(
        `Tenant slug "${LIVE_LESSON_TENANT_SLUG}" not provisioned at boot — skipping ` +
          `toolkit registration. Ontology types/manifest stay registered; the ` +
          `ActionDef tool path activates once the tenant row exists.`,
      );
      return;
    }

    const emitTodo = compileActionToToolDefinition(
      EmitTodoCardAction,
      emitTodoCardHandler,
      LessonSessionManifest,
    );

    this.toolkits.registerToolkit({
      solutionId: tenant.id,
      namespace: LIVE_LESSON_ACTION_NAMESPACE,
      tools: [emitTodo],
    });

    this.logger.log(
      `Live-lesson ontology registered: ${LIVE_LESSON_OBJECT_TYPES.length} object types, ` +
        `manifest "${LessonSessionManifest.name}", 1 action tool ` +
        `"${LIVE_LESSON_ACTION_NAMESPACE}.${EmitTodoCardAction.apiName}" ` +
        `(solutionId=${tenant.id}, slug="${LIVE_LESSON_TENANT_SLUG}").`,
    );
  }
}
