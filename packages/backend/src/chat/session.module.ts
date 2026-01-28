/**
 * Session Module
 *
 * Provides SessionService and EventMapperService as a standalone module.
 * Extracted from ChatModule to break circular dependency:
 *   ChatModule → FilesModule → ChatModule (via SessionService)
 *
 * Now both ChatModule and FilesModule can import SessionModule directly.
 */

import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';

@Module({
  providers: [SessionService, EventMapperService],
  exports: [SessionService, EventMapperService],
})
export class SessionModule {}
