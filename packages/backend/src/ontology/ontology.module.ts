import { Module } from '@nestjs/common';
import { OntologyController } from './ontology.controller';
import {
  OntologyRegistryProvider,
  ONTOLOGY_REGISTRY,
} from './ontology-registry.provider';

@Module({
  controllers: [OntologyController],
  providers: [OntologyRegistryProvider],
  exports: [ONTOLOGY_REGISTRY],
})
export class OntologyModule {}
