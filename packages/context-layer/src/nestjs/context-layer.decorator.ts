import { SetMetadata } from '@nestjs/common';
import { REFERENCEABLE_KEY, TRACKED_KEY } from './context-layer.constants.js';
import type { ReferenceableOptions, TrackedOptions } from '../core/interfaces.js';

export function Referenceable(options: ReferenceableOptions): ClassDecorator {
  return SetMetadata(REFERENCEABLE_KEY, options);
}

export function Tracked(action: string, opts?: { entityType?: string }): MethodDecorator {
  return SetMetadata(TRACKED_KEY, { action, entityType: opts?.entityType } as TrackedOptions);
}
