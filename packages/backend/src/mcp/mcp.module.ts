/**
 * MCP Module
 *
 * Provides MCP server management and REST adapter services.
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpServer } from './entities/mcp-server.entity';
import { McpPoolService } from './mcp-pool.service';
import { RestAdapterService } from './rest-adapter.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([McpServer])],
  providers: [McpPoolService, RestAdapterService],
  exports: [McpPoolService, RestAdapterService],
})
export class McpModule {}
