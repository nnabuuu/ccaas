/**
 * `OntologySealService` — runs `OntologyRegistry.seal()` once, after
 * every solution-side `OnModuleInit` registrar has registered.
 *
 * Why this is a separate service rather than inlined into the live-lesson
 * registrar (pass-3 code-review S1): seal makes the registry immutable,
 * so the *first* solution registrar to seal would crash any *second*
 * registrar that tries to register. The single seal stage decouples the
 * lifecycle: every `OnModuleInit` adds, then this `OnApplicationBootstrap`
 * (which runs after all `OnModuleInit` hooks complete) seals once.
 *
 * If `seal()` throws (cross-def validation failure), the failure is
 * surfaced at boot — better than letting a half-validated registry serve
 * traffic.
 */

import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { OntologyRegistry } from '@kedge-agentic/ontology';
import { ONTOLOGY_REGISTRY } from './ontology-registry.provider';

@Injectable()
export class OntologySealService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OntologySealService.name);

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
  ) {}

  onApplicationBootstrap(): void {
    if (this.registry.isSealed()) return; // tests may seal earlier
    try {
      this.registry.seal();
      this.logger.log(
        `Ontology registry sealed: ` +
          `${this.registry.getAllObjectTypes().length} object types, ` +
          `${this.registry.getAllManifests().length} manifests, ` +
          `${this.registry.getAllFunctions().length} functions.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ontology registry seal failed: ${msg}`);
      throw err;
    }
  }
}
