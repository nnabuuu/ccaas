/**
 * Protocol Module
 *
 * Provides event types, validation, and output transformation services.
 */

import { Module, Global } from '@nestjs/common';
import { OutputSchemaRegistryService } from './output-schema';
import { OutputTransformerService } from './output-transformer.service';
import { ValidationService } from './validation.service';

@Global()
@Module({
  providers: [
    OutputSchemaRegistryService,
    OutputTransformerService,
    ValidationService,
  ],
  exports: [
    OutputSchemaRegistryService,
    OutputTransformerService,
    ValidationService,
  ],
})
export class ProtocolModule {}
