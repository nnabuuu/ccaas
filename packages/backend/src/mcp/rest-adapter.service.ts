/**
 * REST API Adapter Service
 *
 * Converts REST APIs to MCP Tools. Enables exposing legacy REST APIs
 * as AI-callable tools with authentication, rate limiting, and retries.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  RestAdapterConfig,
  RestEndpoint,
  OAuth2Config,
  McpTool,
  ToolExecutionResult,
} from './types';
import { McpValidationError, McpError } from './types';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * REST API Adapter - converts REST endpoints to MCP tools
 */
@Injectable()
export class RestAdapterService {
  private readonly logger = new Logger(RestAdapterService.name);
  private tokenCache: Map<string, CachedToken> = new Map();

  /**
   * Create an adapter instance for a specific configuration
   */
  createAdapter(config: RestAdapterConfig): RestApiAdapter {
    return new RestApiAdapter(config, this.tokenCache, this.logger);
  }
}

/**
 * REST API Adapter instance for a specific configuration
 */
export class RestApiAdapter {
  private rateLimitState: { requestCount: number; windowStart: number } = {
    requestCount: 0,
    windowStart: Date.now(),
  };

  constructor(
    private readonly config: RestAdapterConfig,
    private readonly tokenCache: Map<string, CachedToken>,
    private readonly logger: Logger,
  ) {
    this.validateConfig();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Generate MCP tool definitions from REST endpoints
   */
  generateTools(): McpTool[] {
    return this.config.endpoints.map((endpoint) =>
      this.endpointToTool(endpoint),
    );
  }

  /**
   * Execute a tool call
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    const endpoint = this.config.endpoints.find((e) => e.name === toolName);
    if (!endpoint) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        duration: Date.now() - startTime,
      };
    }

    try {
      this.checkRateLimit();

      const url = this.buildUrl(endpoint, input);
      const headers = await this.buildHeaders(endpoint);
      const body = this.buildBody(endpoint, input);

      const result = await this.executeWithRetry(
        url,
        endpoint.method,
        headers,
        body,
      );

      const mappedData = this.mapResponse(result.data, endpoint);

      return {
        success: true,
        data: mappedData,
        statusCode: result.statusCode,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error as Error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Test connectivity to the API
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
  }> {
    const startTime = Date.now();

    try {
      if (this.config.auth.type === 'oauth2') {
        await this.getOAuth2Token();
      }

      const testEndpoint = this.config.endpoints.find(
        (e) => e.method === 'GET',
      );

      if (testEndpoint) {
        const url = this.buildUrl(testEndpoint, {});
        const headers = await this.buildHeaders(testEndpoint);

        const response = await fetch(url, { method: 'GET', headers });

        return {
          success: response.ok || response.status < 500,
          message: response.ok
            ? 'Connection successful'
            : `HTTP ${response.status}: ${response.statusText}`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        success: true,
        message: 'Configuration valid (no GET endpoints to test)',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${(error as Error).message}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // TOOL GENERATION
  // ==========================================================================

  private endpointToTool(endpoint: RestEndpoint): McpTool {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    // Add path parameters
    if (endpoint.pathParams) {
      for (const [name, schema] of Object.entries(endpoint.pathParams)) {
        properties[name] = {
          type: schema.type,
          description: schema.description || `Path parameter: ${name}`,
        };
        if (schema.enum) {
          (properties[name] as Record<string, unknown>).enum = schema.enum;
        }
        if (schema.required !== false) {
          required.push(name);
        }
      }
    }

    // Add query parameters
    if (endpoint.queryParams) {
      for (const [name, schema] of Object.entries(endpoint.queryParams)) {
        properties[name] = {
          type: schema.type,
          description: schema.description || `Query parameter: ${name}`,
        };
        if (schema.default !== undefined) {
          (properties[name] as Record<string, unknown>).default = schema.default;
        }
        if (schema.enum) {
          (properties[name] as Record<string, unknown>).enum = schema.enum;
        }
        if (schema.required) {
          required.push(name);
        }
      }
    }

    // Add body parameters
    if (endpoint.body?.schema) {
      for (const [name, schema] of Object.entries(endpoint.body.schema)) {
        properties[name] = {
          type: schema.type,
          description: schema.description || `Body field: ${name}`,
        };
        if (schema.enum) {
          (properties[name] as Record<string, unknown>).enum = schema.enum;
        }
        if (schema.required) {
          required.push(name);
        }
      }
    }

    return {
      name: endpoint.name,
      description: endpoint.description,
      inputSchema: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
    };
  }

  // ==========================================================================
  // REQUEST BUILDING
  // ==========================================================================

  private buildUrl(
    endpoint: RestEndpoint,
    input: Record<string, unknown>,
  ): string {
    let path = endpoint.path;

    if (endpoint.pathParams) {
      for (const [name, schema] of Object.entries(endpoint.pathParams)) {
        const value = input[name];
        if (value !== undefined) {
          path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
        } else if (schema.required !== false) {
          throw new McpValidationError(`Missing required path parameter: ${name}`);
        }
      }
    }

    const url = new URL(path, this.config.baseUrl);

    if (endpoint.queryParams) {
      for (const [name, schema] of Object.entries(endpoint.queryParams)) {
        let value = input[name];
        if (value === undefined && schema.default !== undefined) {
          value = schema.default;
        }
        if (value !== undefined) {
          url.searchParams.set(name, String(value));
        }
      }
    }

    return url.toString();
  }

  private async buildHeaders(
    endpoint: RestEndpoint,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.config.headers,
      ...endpoint.headers,
    };

    await this.addAuthHeaders(headers);
    return headers;
  }

  private async addAuthHeaders(headers: Record<string, string>): Promise<void> {
    const auth = this.config.auth;

    switch (auth.type) {
      case 'api_key':
        if (auth.apiKeyLocation === 'header') {
          headers[auth.apiKeyName || 'X-API-Key'] = auth.apiKeyValue || '';
        }
        break;

      case 'bearer':
        headers[auth.headerName || 'Authorization'] =
          `${auth.headerPrefix || 'Bearer '}${auth.token || ''}`;
        break;

      case 'basic': {
        const credentials = Buffer.from(
          `${auth.username || ''}:${auth.password || ''}`,
        ).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;
      }

      case 'oauth2': {
        const token = await this.getOAuth2Token();
        headers['Authorization'] = `Bearer ${token}`;
        break;
      }
    }
  }

  private buildBody(
    endpoint: RestEndpoint,
    input: Record<string, unknown>,
  ): string | undefined {
    if (!endpoint.body?.schema) {
      return undefined;
    }

    const body: Record<string, unknown> = {};

    for (const [name, schema] of Object.entries(endpoint.body.schema)) {
      if (input[name] !== undefined) {
        body[name] = input[name];
      } else if (schema.required) {
        throw new McpValidationError(`Missing required body field: ${name}`);
      }
    }

    return JSON.stringify(body);
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  private async getOAuth2Token(): Promise<string> {
    if (!this.config.oauth2) {
      throw new McpValidationError('OAuth2 configuration required');
    }

    const cacheKey = `${this.config.oauth2.tokenUrl}:${this.config.oauth2.clientId}`;
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    const oauth = this.config.oauth2;
    const response = await fetch(oauth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: oauth.grantType || 'client_credentials',
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        scope: oauth.scopes.join(' '),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new McpError('OAUTH_ERROR', `OAuth2 token request failed: ${error}`, 401);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in?: number;
    };
    const accessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;

    this.tokenCache.set(cacheKey, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return accessToken;
  }

  // ==========================================================================
  // REQUEST EXECUTION
  // ==========================================================================

  private async executeWithRetry(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<{ data: unknown; statusCode: number }> {
    const options: RetryOptions = {
      maxRetries: this.config.rateLimiting?.maxRetries ?? 3,
      baseDelay: this.config.rateLimiting?.retryAfterMs ?? 1000,
      maxDelay: 30000,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(this.config.timeout || 30000),
        });

        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get('retry-after') || '1',
          );
          await this.sleep(retryAfter * 1000);
          continue;
        }

        if (response.status >= 500 && attempt < options.maxRetries) {
          const delay = Math.min(
            options.baseDelay * Math.pow(2, attempt),
            options.maxDelay,
          );
          await this.sleep(delay);
          continue;
        }

        const contentType = response.headers.get('content-type');
        let data: unknown;

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        if (!response.ok) {
          const errorMessage = this.getErrorMessage(response.status, data);
          throw new McpError('API_ERROR', errorMessage, response.status);
        }

        return { data, statusCode: response.status };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof McpError && error.statusCode < 500) {
          throw error;
        }

        if (attempt < options.maxRetries) {
          const delay = Math.min(
            options.baseDelay * Math.pow(2, attempt),
            options.maxDelay,
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private getErrorMessage(statusCode: number, data: unknown): string {
    if (this.config.errorMapping) {
      const customMessage = this.config.errorMapping[String(statusCode)];
      if (customMessage) return customMessage;
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.message === 'string') return obj.message;
      if (typeof obj.error === 'string') return obj.error;
      if (typeof obj.error_description === 'string')
        return obj.error_description;
    }

    const defaultMessages: Record<number, string> = {
      400: 'Bad request',
      401: 'Authentication failed',
      403: 'Permission denied',
      404: 'Resource not found',
      409: 'Conflict',
      422: 'Validation failed',
      500: 'Server error',
      502: 'Bad gateway',
      503: 'Service unavailable',
      504: 'Gateway timeout',
    };

    return defaultMessages[statusCode] || `HTTP ${statusCode}`;
  }

  // ==========================================================================
  // RESPONSE MAPPING
  // ==========================================================================

  private mapResponse(data: unknown, endpoint: RestEndpoint): unknown {
    if (
      !endpoint.responseMapping ||
      typeof data !== 'object' ||
      data === null
    ) {
      return data;
    }

    const result: Record<string, unknown> = {};

    for (const [key, jsonPath] of Object.entries(endpoint.responseMapping)) {
      result[key] = this.getValueByPath(data, jsonPath);
    }

    return result;
  }

  private getValueByPath(obj: unknown, path: string): unknown {
    if (!path.startsWith('$.')) return obj;

    const parts = path.substring(2).split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================

  private checkRateLimit(): void {
    if (!this.config.rateLimiting) return;

    const now = Date.now();
    const windowDuration = 60000;

    if (now - this.rateLimitState.windowStart > windowDuration) {
      this.rateLimitState = { requestCount: 0, windowStart: now };
    }

    if (
      this.rateLimitState.requestCount >=
      this.config.rateLimiting.requestsPerMinute
    ) {
      const waitTime =
        windowDuration - (now - this.rateLimitState.windowStart);
      throw new McpError(
        'RATE_LIMIT',
        `Rate limit exceeded. Retry after ${waitTime}ms`,
        429,
        { retryAfter: waitTime },
      );
    }

    this.rateLimitState.requestCount++;
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new McpValidationError('baseUrl is required');
    }

    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new McpValidationError('Invalid baseUrl format');
    }

    if (!this.config.endpoints || this.config.endpoints.length === 0) {
      throw new McpValidationError('At least one endpoint is required');
    }

    for (const endpoint of this.config.endpoints) {
      if (!endpoint.name) {
        throw new McpValidationError('Endpoint name is required');
      }
      if (!endpoint.path) {
        throw new McpValidationError(
          `Endpoint path is required for ${endpoint.name}`,
        );
      }
      if (!endpoint.method) {
        throw new McpValidationError(
          `Endpoint method is required for ${endpoint.name}`,
        );
      }
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatError(error: Error): string {
    if (error instanceof McpError) return error.message;
    return error.message || 'Unknown error';
  }
}
