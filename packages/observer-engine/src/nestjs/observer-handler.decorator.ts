import { SetMetadata } from '@nestjs/common';
import { OBSERVER_HANDLER_METADATA } from './constants.js';

export interface ObserverHandlerMeta {
  eventType: string;
}

export function ObserverHandler(eventType: string): MethodDecorator {
  return SetMetadata(OBSERVER_HANDLER_METADATA, {
    eventType,
  } satisfies ObserverHandlerMeta);
}
