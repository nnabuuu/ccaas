/**
 * Bundle Module
 *
 * Provides bundle registry and management services.
 */

import { Module } from '@nestjs/common';
import { BundleService } from './bundle.service';

@Module({
  providers: [BundleService],
  exports: [BundleService],
})
export class BundleModule {}
