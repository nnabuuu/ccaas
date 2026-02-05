import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { KnowledgePointsModule } from '../knowledge-points/knowledge-points.module';

@Module({
  imports: [KnowledgePointsModule],
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
