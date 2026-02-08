import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  imports: [],
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
