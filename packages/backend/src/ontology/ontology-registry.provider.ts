import { Provider } from '@nestjs/common';
import { OntologyRegistry } from '@kedge-agentic/ontology';

export const ONTOLOGY_REGISTRY = 'ONTOLOGY_REGISTRY';

export const OntologyRegistryProvider: Provider = {
  provide: ONTOLOGY_REGISTRY,
  useFactory: () => new OntologyRegistry(),
};
