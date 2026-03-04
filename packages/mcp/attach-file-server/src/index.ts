#!/usr/bin/env node
/**
 * Core Attach File MCP Server
 *
 * Provides the `attach_file` tool as a platform-level capability.
 * Registers files with CCAAS file management API and returns
 * a generic AttachmentOutput structure that solutions can interpret.
 *
 * Environment variables:
 * - CCAAS_URL: Base URL of the CCAAS backend (default: http://localhost:3001)
 * - AGENT_SESSION_ID: Current session ID (set by CCAAS)
 * - AGENT_CLIENT_ID: Current tenant/client ID (set by CCAAS)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { lookup as mimeLookup } from 'mime-types';
import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Generic attachment output structure.
 * Solutions interpret this based on their own domain model.
 */
interface AttachmentOutput {
  /** Unique attachment ID */
  id: string;
  /** CCAAS file registration ID */
  fileId: string;
  /** Original file name */
  fileName: string;
  /** MIME type (auto-detected) */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** CCAAS download URL */
  downloadUrl: string;
  /** ISO timestamp */
  uploadedAt: string;
  /** Optional description */
  description?: string;
}

/**
 * WriteOutputResult format — compatible with EventMapper output_update parsing.
 */
interface WriteOutputResult {
  data: {
    field: string;
    value: unknown;
    preview?: string;
  };
  status: 'success' | 'error';
}

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'attach-file-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'attach_file',
        description: `Attach a file from the session workspace as an output attachment.

This tool registers a file with the CCAAS file management system and creates
an output_update event so the frontend can display and download the file.

Supported file types: any file in the session workspace directory.

Example usage:
{
  "filePath": "report.pdf",
  "description": "Generated analysis report"
}

Note: filePath should be relative to the session workspace directory.`,
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to file in session workspace (relative path)',
            },
            description: {
              type: 'string',
              description: 'Optional description of the file',
            },
          },
          required: ['filePath'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== 'attach_file') {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  const { filePath, description } = args as {
    filePath: string;
    description?: string;
  };

  // Resolve absolute path within workspace
  const workspaceDir = process.cwd();
  const absolutePath = path.resolve(workspaceDir, filePath);

  // Path traversal guard: ensure resolved path stays within workspace
  if (!absolutePath.startsWith(workspaceDir + path.sep) && absolutePath !== workspaceDir) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            data: { error: `Path traversal denied: ${filePath}` },
            status: 'error',
          }),
        },
      ],
      isError: true,
    };
  }

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            data: { error: `File not found: ${filePath}` },
            status: 'error',
          }),
        },
      ],
      isError: true,
    };
  }

  // Get file stats
  const stats = fs.statSync(absolutePath);
  const fileName = path.basename(filePath);
  const mimeType = mimeLookup(absolutePath) || 'application/octet-stream';

  // Register file with CCAAS
  const sessionId = process.env.AGENT_SESSION_ID || 'unknown';
  const tenantId = process.env.AGENT_CLIENT_ID;
  const ccaasUrl = process.env.CCAAS_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${ccaasUrl}/api/v1/files/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalPath: absolutePath,
        sessionId,
        tenantId,
      }),
    });

    if (!response.ok) {
      throw new Error(`CCAAS file registration failed: ${response.statusText}`);
    }

    const responseData = await response.json() as { fileId: string; filename: string; downloadUrl: string };
    const { fileId, filename, downloadUrl } = responseData;

    // Create generic attachment output
    const attachment: AttachmentOutput = {
      id: randomUUID(),
      fileId,
      fileName: filename,
      mimeType,
      size: stats.size,
      downloadUrl,
      uploadedAt: new Date().toISOString(),
      description,
    };

    // Return in WriteOutputResult format for EventMapper compatibility
    const result: WriteOutputResult = {
      data: {
        field: 'attachments',
        value: [attachment],
        preview: `📎 ${filename} (${formatBytes(stats.size)})`,
      },
      status: 'success',
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            data: { error: `Failed to register file: ${errorMessage}` },
            status: 'error',
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('attach-file-server started');
}

main().catch((error) => {
  console.error('Failed to start attach-file-server:', error);
  process.exit(1);
});
