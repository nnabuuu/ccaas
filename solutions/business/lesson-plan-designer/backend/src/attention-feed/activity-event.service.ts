import { Injectable, Logger } from '@nestjs/common';

export interface ActivityEvent {
  userId: string;
  category: string;
  title: string;
  description?: string;
  itemType: string;
  itemId: string;
  targetPath?: string;
}

@Injectable()
export class ActivityEventService {
  private readonly logger = new Logger(ActivityEventService.name);

  publish(event: ActivityEvent): void {
    this.logger.debug(`Activity: [${event.category}] ${event.title} (${event.itemType}:${event.itemId})`);
  }
}
