import { Module, forwardRef } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { ToolCallerModule } from '../tool-caller/tool-caller.module';
import { OntologyController } from './ontology.controller';
import {
  OntologyRegistryProvider,
  ONTOLOGY_REGISTRY,
} from './ontology-registry.provider';
import { ManifestAccessorService } from './manifest-accessor.service';
import { OntologySealService } from './ontology-seal.service';

/**
 * Wires the ontology layer into NestJS:
 *
 *   - `OntologyRegistry` singleton (token: `ONTOLOGY_REGISTRY`).
 *   - `GET /api/v1/ontology/schema` (ETag-aware).
 *   - `ManifestAccessorService` factory for per-request
 *     `ManifestAccessor` instances.
 *
 * SessionsModule + ToolCallerModule are imported so the accessor can
 * read/write SessionMetadata and dispatch actions through the proxy.
 * forwardRef on SessionsModule mirrors the existing pattern there —
 * SessionMetadataService takes SessionService via forwardRef so the
 * surface cycle is already declared.
 *
 * Generic — knows nothing about live-lesson. Solution-specific ontology
 * registrars (e.g. `LiveLessonOntologyService`) live in their own
 * `@kedge-agentic/<solution>-platform-handlers` package and register
 * manifests / objects / actions at boot via the same
 * `ONTOLOGY_REGISTRY` + `SolutionToolkitRegistry` they consume here.
 * Phase 5.5 carved out the prior in-tree `LiveLessonOntologyService`.
 */
@Module({
  imports: [forwardRef(() => SessionsModule), ToolCallerModule],
  controllers: [OntologyController],
  providers: [
    OntologyRegistryProvider,
    ManifestAccessorService,
    // Seal runs after every solution registrar's onModuleInit. See
    // OntologySealService header for the lifecycle rationale.
    OntologySealService,
  ],
  exports: [ONTOLOGY_REGISTRY, ManifestAccessorService],
})
export class OntologyModule {}
