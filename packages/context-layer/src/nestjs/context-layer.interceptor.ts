import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { REFERENCEABLE_KEY, TRACKED_KEY } from './context-layer.constants.js';
import type { ReferenceableOptions, TrackedOptions } from '../core/interfaces.js';
import { ActivityEmitter } from '../core/activity-emitter.js';
import type { ClsContext } from '../core/activity-emitter.js';

@Injectable()
export class ContextLayerInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private activityEmitter: ActivityEmitter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const refOptions = this.reflector.get<ReferenceableOptions>(REFERENCEABLE_KEY, context.getClass());
    const trackedOptions = this.reflector.get<TrackedOptions>(TRACKED_KEY, context.getHandler());

    if (!refOptions && !trackedOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only auto-track write operations for @Referenceable controllers
    const shouldAutoTrack = refOptions && this.isWriteMethod(method) && refOptions.abilities?.track !== false;

    if (!shouldAutoTrack && !trackedOptions) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (result) => {
        try {
          const entityType = trackedOptions?.entityType ?? refOptions?.type;
          if (!entityType) return;

          const action = trackedOptions?.action ?? this.inferAction(method);
          const ctx: ClsContext = {
            userId: request.headers['x-user-id'] ?? 'anonymous',
            tenantId: request.headers['x-tenant-id'] ?? 'default',
            sessionId: request.headers['x-session-id'] ?? '',
          };

          const entityId = this.extractEntityId(result, request);
          const displayName = this.extractDisplayName(result);

          await this.activityEmitter.emit(ctx, {
            entityType,
            entityId,
            entityDisplayName: displayName,
            action: action as 'referenced' | 'viewed' | 'created' | 'updated' | 'deleted',
            source: trackedOptions ? 'tracked_decorator' : 'auto_track',
          });
        } catch {
          // Activity tracking should not break the main request
        }
      }),
    );
  }

  private isWriteMethod(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  }

  private inferAction(method: string): string {
    switch (method) {
      case 'POST': return 'created';
      case 'PUT':
      case 'PATCH': return 'updated';
      case 'DELETE': return 'deleted';
      default: return 'viewed';
    }
  }

  private extractEntityId(result: unknown, request: { params?: Record<string, string> }): string {
    if (result && typeof result === 'object' && 'id' in result) {
      return String((result as Record<string, unknown>).id);
    }
    return request.params?.id ?? 'unknown';
  }

  private extractDisplayName(result: unknown): string {
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      return String(r.displayName ?? r.title ?? r.name ?? 'Unknown');
    }
    return 'Unknown';
  }
}
