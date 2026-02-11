#!/usr/bin/env node
/**
 * Shared Context MCP Server
 *
 * Provides read_context tool for all CCAAS solutions to read page context.
 * Supports two modes:
 * - full: Returns complete context (default)
 * - diff: Returns only fields that changed since last read (90-95% token savings)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

const server = new Server(
  { name: 'shared-context-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const readContextTool: Tool = {
  name: 'read_context',
  description: `Read the current page context synced from the frontend.

Returns the page type and all associated data. Use this BEFORE responding to understand what the user is currently viewing/editing.

Supports two modes:
- 'full': Returns complete context (default)
- 'diff': Returns only fields that changed since last read (saves tokens)

Returns structure:
{
  pageType: string,      // 'lesson-plan-editor' | 'quiz-analyzer' | etc.
  pageData: object,      // Solution-specific data (full or diff)
  timestamp: string,     // ISO timestamp of last update
  isDiff?: boolean       // true if returning diff, false/undefined if full
}

Examples:
- Lesson plan editor: { pageType: 'lesson-plan-editor', pageData: { lessonPlanId, currentForm } }
- Quiz analyzer: { pageType: 'quiz-analyzer', pageData: { quizId, currentAnalysis } }
- Problem explainer: { pageType: 'problem-explainer', pageData: { problemId, currentState } }`,
  inputSchema: {
    type: 'object',
    properties: {
      contextKey: {
        type: 'string',
        description: 'Optional: specific key to read from context (e.g., "lessonPlanId")',
      },
      mode: {
        type: 'string',
        enum: ['full', 'diff'],
        description: 'Read mode: "full" (complete context) or "diff" (only changed fields). Default: "full"',
      },
    },
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [readContextTool],
}));

// Store previous context per session for diff calculation
const previousContexts = new Map<string, Record<string, unknown>>();

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'read_context') {
    const sessionId = process.env.AGENT_SESSION_ID;
    const workspaceDir = process.env.AGENT_WORKSPACE_DIR || process.cwd();

    const contextPath = path.join(
      workspaceDir,
      'sessions',
      sessionId || '',
      '.context',
      'page-context.json'
    );

    try {
      if (!fs.existsSync(contextPath)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'No page context found',
              hint: 'User has not interacted with the page yet, or context was not synced',
            }),
          }],
          isError: true,
        };
      }

      const contextData = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
      const mode = args?.mode || 'full';

      // If specific key requested, return just that
      if (args?.contextKey && typeof contextData === 'object') {
        const contextKey = args.contextKey as string;
        const value = (contextData as Record<string, unknown>)[contextKey];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ [contextKey]: value }, null, 2),
          }],
        };
      }

      // Handle diff mode
      if (mode === 'diff' && sessionId) {
        const previousContext = previousContexts.get(sessionId);

        if (!previousContext) {
          // First read - return full context and store it
          previousContexts.set(sessionId, JSON.parse(JSON.stringify(contextData)));
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ ...contextData, isDiff: false }, null, 2),
            }],
          };
        }

        // Calculate diff
        const diff = calculateDiff(previousContext, contextData);

        // Update stored context
        previousContexts.set(sessionId, JSON.parse(JSON.stringify(contextData)));

        // Return diff (empty object if no changes)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              pageType: contextData.pageType,
              pageData: diff,
              timestamp: contextData.timestamp,
              isDiff: true,
            }, null, 2),
          }],
        };
      }

      // Return full context
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(contextData, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Failed to read context: ${errorMessage}`,
            contextPath,
          }),
        }],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown tool' }) }],
    isError: true,
  };
});

/**
 * Deep diff calculation helper
 * Returns an object with:
 * - New properties
 * - Changed properties (with new values)
 * - Deleted properties (marked with null)
 */
function calculateDiff(oldObj: any, newObj: any): any {
  if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
    return oldObj !== newObj ? newObj : undefined;
  }

  const diff: any = {};

  // Check for new or changed properties
  for (const key in newObj) {
    if (!(key in oldObj)) {
      // New property
      diff[key] = newObj[key];
    } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      // Changed property (deep comparison)
      if (typeof newObj[key] === 'object' && newObj[key] !== null) {
        const nestedDiff = calculateDiff(oldObj[key], newObj[key]);
        if (Object.keys(nestedDiff).length > 0) {
          diff[key] = nestedDiff;
        }
      } else {
        diff[key] = newObj[key];
      }
    }
  }

  // Mark deleted properties with null
  for (const key in oldObj) {
    if (!(key in newObj)) {
      diff[key] = null;
    }
  }

  return diff;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
