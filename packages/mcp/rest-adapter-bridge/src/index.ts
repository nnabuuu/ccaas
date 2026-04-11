#!/usr/bin/env node
/**
 * REST Adapter Bridge — Stdio MCP Server
 *
 * Reads a RestAdapterConfig from REST_ADAPTER_CONFIG env var,
 * exposes each endpoint as an MCP tool, and forwards tool calls
 * as HTTP requests to the configured baseUrl.
 *
 * Environment variables:
 * - REST_ADAPTER_CONFIG: JSON-serialised RestAdapterConfig
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Types (subset of backend RestAdapterConfig — kept self-contained)
// Canonical source: packages/backend/src/mcp/types.ts
// Bridge intentionally duplicates rather than importing to avoid NestJS deps.
// ============================================================================

export interface RestAdapterConfig {
  baseUrl: string;
  auth: RestAdapterAuth;
  endpoints: RestEndpoint[];
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RestAdapterAuth {
  type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';
  apiKeyName?: string;
  apiKeyLocation?: 'header' | 'query';
  apiKeyValue?: string;
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
  headerPrefix?: string;
}

export interface RestEndpoint {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  pathParams?: Record<string, ParamSchema>;
  queryParams?: Record<string, ParamSchema>;
  body?: BodySchema;
  headers?: Record<string, string>;
}

export interface ParamSchema {
  type: 'string' | 'integer' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
}

export interface BodySchema {
  type: 'json' | 'form' | 'multipart';
  schema: Record<string, ParamSchema>;
}

// ============================================================================
// Config parsing
// ============================================================================

export function parseConfig(): RestAdapterConfig {
  const raw = process.env.REST_ADAPTER_CONFIG;
  if (!raw) {
    throw new Error('REST_ADAPTER_CONFIG environment variable is required');
  }
  const config = JSON.parse(raw) as RestAdapterConfig;
  if (!config.baseUrl || !config.endpoints?.length) {
    throw new Error('REST_ADAPTER_CONFIG must have baseUrl and at least one endpoint');
  }

  // Validate URL scheme
  const url = new URL(config.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported protocol in baseUrl: ${url.protocol}`);
  }

  // Validate endpoints have required fields
  for (const ep of config.endpoints) {
    if (!ep.name || !ep.method || !ep.path) {
      throw new Error(`Endpoint "${ep.name ?? '(unnamed)'}" missing required fields (name, method, path)`);
    }
  }

  return config;
}

// ============================================================================
// Tool schema generation (mirrors RestApiAdapter.endpointToTool logic)
// ============================================================================

export function endpointToTool(endpoint: RestEndpoint) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  if (endpoint.pathParams) {
    for (const [name, schema] of Object.entries(endpoint.pathParams)) {
      properties[name] = {
        type: schema.type === 'integer' ? 'number' : schema.type,
        description: schema.description ?? `Path parameter: ${name}`,
        ...(schema.enum ? { enum: schema.enum } : {}),
      };
      required.push(name);
    }
  }

  if (endpoint.queryParams) {
    for (const [name, schema] of Object.entries(endpoint.queryParams)) {
      properties[name] = {
        type: schema.type === 'integer' ? 'number' : schema.type,
        description: schema.description ?? `Query parameter: ${name}`,
        ...(schema.default !== undefined ? { default: schema.default } : {}),
        ...(schema.enum ? { enum: schema.enum } : {}),
      };
      if (schema.required) {
        required.push(name);
      }
    }
  }

  if (endpoint.body?.schema) {
    for (const [name, schema] of Object.entries(endpoint.body.schema)) {
      properties[name] = {
        type: schema.type === 'integer' ? 'number' : schema.type,
        description: schema.description ?? `Body field: ${name}`,
        ...(schema.default !== undefined ? { default: schema.default } : {}),
        ...(schema.enum ? { enum: schema.enum } : {}),
      };
      if (schema.required) {
        required.push(name);
      }
    }
  }

  return {
    name: endpoint.name,
    description: endpoint.description,
    inputSchema: {
      type: 'object' as const,
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
  };
}

// ============================================================================
// HTTP request execution
// ============================================================================

export function buildAuthHeaders(auth: RestAdapterAuth): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (auth.type) {
    case 'bearer':
      if (auth.token) {
        const headerName = auth.headerName ?? 'Authorization';
        const prefix = auth.headerPrefix ?? 'Bearer';
        headers[headerName] = `${prefix} ${auth.token}`;
      }
      break;
    case 'basic':
      if (auth.username && auth.password) {
        const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
    case 'api_key':
      if (auth.apiKeyLocation === 'header' && auth.apiKeyName && auth.apiKeyValue) {
        headers[auth.apiKeyName] = auth.apiKeyValue;
      }
      break;
  }

  return headers;
}

export function buildUrl(
  baseUrl: string,
  endpoint: RestEndpoint,
  args: Record<string, unknown>,
  auth: RestAdapterAuth,
): string {
  let resolvedPath = endpoint.path;
  if (endpoint.pathParams) {
    for (const paramName of Object.keys(endpoint.pathParams)) {
      const value = args[paramName];
      if (value !== undefined) {
        resolvedPath = resolvedPath.replace(`{${paramName}}`, encodeURIComponent(String(value)));
      }
    }
  }

  const url = new URL(resolvedPath, baseUrl);

  if (endpoint.queryParams) {
    for (const [name, schema] of Object.entries(endpoint.queryParams)) {
      const value = args[name] ?? schema.default;
      if (value !== undefined) {
        url.searchParams.set(name, String(value));
      }
    }
  }

  if (auth.type === 'api_key' && auth.apiKeyLocation === 'query' && auth.apiKeyName && auth.apiKeyValue) {
    url.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
  }

  return url.toString();
}

export function buildBody(
  endpoint: RestEndpoint,
  args: Record<string, unknown>,
): unknown | undefined {
  if (!endpoint.body?.schema) return undefined;

  const body: Record<string, unknown> = {};

  for (const [name, schema] of Object.entries(endpoint.body.schema)) {
    const value = args[name] ?? schema.default;
    if (value !== undefined) {
      body[name] = value;
    }
  }

  return Object.keys(body).length > 0 ? body : undefined;
}

export async function executeEndpoint(
  config: RestAdapterConfig,
  endpoint: RestEndpoint,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const url = buildUrl(config.baseUrl, endpoint, args, config.auth);

  const headers: Record<string, string> = {
    ...buildAuthHeaders(config.auth),
    ...(config.headers ?? {}),
    ...(endpoint.headers ?? {}),
  };

  // Only JSON body type is supported; reject form/multipart
  if (endpoint.body && endpoint.body.type !== 'json') {
    return {
      content: [{ type: 'text', text: `Unsupported body type: ${endpoint.body.type}. Only "json" is supported.` }],
      isError: true,
    };
  }

  const body = buildBody(endpoint, args);
  const hasBody = body !== undefined && ['POST', 'PUT', 'PATCH'].includes(endpoint.method);

  if (hasBody) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const controller = new AbortController();
  const timeout = config.timeout ?? 30000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        content: [{ type: 'text', text: `HTTP ${response.status}: ${text}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: text || '(empty response)' }],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      content: [{ type: 'text', text: isTimeout ? `Request timed out after ${timeout}ms` : `Request failed: ${message}` }],
      isError: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// Server Setup
// ============================================================================

async function main() {
  const config = parseConfig();

  const endpointMap = new Map<string, RestEndpoint>();
  for (const ep of config.endpoints) {
    endpointMap.set(ep.name, ep);
  }

  const server = new Server(
    { name: 'rest-adapter-bridge', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: config.endpoints.map(endpointToTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const endpoint = endpointMap.get(name);

    if (!endpoint) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return executeEndpoint(config, endpoint, (args ?? {}) as Record<string, unknown>);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('rest-adapter-bridge started');
}

// Guard: only auto-run when executed directly (skip when imported by tests)
if (!process.env.JEST_WORKER_ID) {
  main().catch((error) => {
    console.error('Failed to start rest-adapter-bridge:', error);
    process.exit(1);
  });
}
