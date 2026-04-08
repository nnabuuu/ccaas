import type { ActivityQueue, ActivityRecord } from './interfaces.js';
import type { RecommendEngine } from './recommend-engine.js';

export interface EmitParams {
  entityType: string;
  entityId: string;
  entityDisplayName: string;
  action: ActivityRecord['action'];
  source: ActivityRecord['source'];
}

export interface ClsContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  sessionTemplateId?: string;
}

export class ActivityEmitter {
  constructor(
    private queue: ActivityQueue,
    private recommend: RecommendEngine,
  ) {}

  async emit(ctx: ClsContext, params: EmitParams): Promise<void> {
    const record: ActivityRecord = {
      ...ctx,
      ...params,
      timestamp: Date.now(),
    };

    await this.queue.add(record);
    await this.recommend.incrementScore(
      ctx.tenantId,
      ctx.userId,
      ctx.sessionId,
      {
        entityType: params.entityType,
        entityId: params.entityId,
        displayName: params.entityDisplayName,
        action: params.action,
      },
    );
  }
}
