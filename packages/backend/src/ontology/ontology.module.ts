import { Module, forwardRef } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { ToolCallerModule } from '../tool-caller/tool-caller.module';
import { OntologyController } from './ontology.controller';
import {
  OntologyRegistryProvider,
  ONTOLOGY_REGISTRY,
} from './ontology-registry.provider';
import { ManifestAccessorService } from './manifest-accessor.service';

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
 * Dead-code from the runtime perspective until consumers (Solutions)
 * register manifests, ObjectTypes, and ActionDef-routed tools.
 */
@Module({
  imports: [forwardRef(() => SessionsModule), ToolCallerModule],
  controllers: [OntologyController],
  providers: [OntologyRegistryProvider, ManifestAccessorService],
  exports: [ONTOLOGY_REGISTRY, ManifestAccessorService],
})
export class OntologyModule {}
