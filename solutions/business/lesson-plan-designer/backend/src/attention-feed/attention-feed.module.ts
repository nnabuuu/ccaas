import { Module, Global } from '@nestjs/common';
import { ActivityEventService } from './activity-event.service';

@Global()
@Module({
  providers: [ActivityEventService],
  exports: [ActivityEventService],
})
export class AttentionFeedModule {}
