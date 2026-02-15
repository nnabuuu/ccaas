import { Module } from '@nestjs/common';

/**
 * MCP integration module.
 * Handles communication with the MCP server for AI tool operations.
 * The MCP server runs as a separate process (see solution.json mcpServers config).
 */
@Module({})
export class McpModule {}
