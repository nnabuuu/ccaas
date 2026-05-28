/**
 * ToolCaller Module — platform-owned tool-call boundary.
 *
 * Provides `ToolCallerProxyService` (the pipeline) and
 * `SolutionToolkitRegistry` (the in-process tool registry). Other
 * modules import this when they need to register tools (the solution
 * loader) or invoke them (the engine adapter, which lands in a later
 * phase).
 *
 * Global so SolutionLoaderService + the engine adapter (Phase 3) can
 * grab the registry without juggling forwardRef chains.
 *
 * Reference: docs/design-tool-caller-proxy.md §5.
 */

import { Module, Global } from '@nestjs/common';
import { ToolCallerProxyService } from './tool-caller-proxy.service';
import { SolutionToolkitRegistry } from './solution-toolkit-registry';
import { McpEngineAdapterService } from './adapters/mcp-engine-adapter.service';
import { InternalToolCallerController } from './internal-tool-caller.controller';

@Global()
@Module({
  controllers: [InternalToolCallerController],
  providers: [
    SolutionToolkitRegistry,
    ToolCallerProxyService,
    McpEngineAdapterService,
  ],
  exports: [
    SolutionToolkitRegistry,
    ToolCallerProxyService,
    McpEngineAdapterService,
  ],
})
export class ToolCallerModule {}
